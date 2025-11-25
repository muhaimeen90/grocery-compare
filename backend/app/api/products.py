"""
Product API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, distinct
from typing import Optional, List
from ..database import get_db
from ..models import Product as ProductModel
from ..schemas import Product, ProductList, CategoryCount
from ..services.vector_search_service import get_vector_search_service
from ..utils.ranking_utils import rank_search_results
from ..config import settings
import math

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=ProductList)
def get_products(
    store: Optional[str] = Query(None, description="Filter by store (IGA, Woolworths, Coles)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search in product name and brand"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    sort: Optional[str] = Query("name", description="Sort by field (name, price_low, price_high)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(30, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    Get paginated list of products with filters.
    Uses semantic search when search query is provided.
    """
    # If search query is provided, use semantic search
    if search and search.strip():
        return _semantic_search_products(
            search=search,
            store=store,
            category=category,
            brand=brand,
            sort=sort,
            page=page,
            limit=limit,
            db=db
        )
    
    # Otherwise, use traditional database query
    return _database_query_products(
        store=store,
        category=category,
        brand=brand,
        sort=sort,
        page=page,
        limit=limit,
        db=db
    )


def _semantic_search_products(
    search: str,
    store: Optional[str],
    category: Optional[str],
    brand: Optional[str],
    sort: str,
    page: int,
    limit: int,
    db: Session
) -> ProductList:
    """
    Perform semantic search using Pinecone vector database
    """
    vector_service = get_vector_search_service()
    
    # Check if vector search is available
    if not vector_service.is_available():
        # Fallback to database search
        return _database_query_products(
            store=store,
            category=category,
            brand=brand,
            sort=sort,
            page=page,
            limit=limit,
            db=db,
            search=search
        )
    
    # Perform vector search with larger top_k to ensure we have enough results after filtering
    # We fetch more than needed to account for pagination
    vector_top_k = limit * page + 50  # Get extra results for pagination
    
    # Perform hybrid search with filters
    # Lower alpha (0.35) gives more weight to keyword matching (BM25)
    # This helps exact keyword matches score higher while maintaining semantic search benefits
    vector_results = vector_service.search_with_category(
        query=search,
        category=category,
        store=store,
        brand=brand,
        top_k=vector_top_k,
        score_threshold=0.5,
        alpha=settings.VECTOR_SEARCH_ALPHA  # Keyword-heavy for better exact matching
    )
    
    # If no results found, return empty
    if not vector_results:
        return ProductList(
            products=[],
            total=0,
            page=page,
            pages=0,
            limit=limit
        )
    
    # Extract product IDs from vector search results
    product_ids = [result.get('product_id') or result.get('id') for result in vector_results]
    
    # Fetch full product details from database to ensure data consistency
    query = db.query(ProductModel).filter(ProductModel.id.in_(product_ids))
    
    # Apply additional filters that might not be in vector results
    if store:
        query = query.filter(ProductModel.store == store)
    if category:
        query = query.filter(ProductModel.category == category)
    if brand:
        query = query.filter(ProductModel.brand == brand)
    
    # Get all matching products
    all_products = query.all()
    
    # Create a mapping of product_id to product for efficient lookup
    product_map = {p.id: p for p in all_products}
    
    # Get products that match vector results (preserve for ranking)
    matched_products = []
    for result in vector_results:
        pid = result.get('product_id') or result.get('id')
        if pid in product_map:
            matched_products.append(product_map[pid])
    
    # Apply advanced ranking: exact matches first, then word overlap, then semantic similarity
    sorted_products = rank_search_results(
        products=matched_products,
        vector_results=vector_results,
        search_query=search,
        exact_match_bonus=settings.RANKING_EXACT_MATCH_BONUS,
        word_overlap_weight=settings.RANKING_WORD_OVERLAP_WEIGHT,
        brand_match_weight=settings.RANKING_BRAND_MATCH_WEIGHT,
        vector_weight=settings.RANKING_VECTOR_WEIGHT
    )
    
    # Apply additional sorting if requested
    if sort == "price_low":
        sorted_products.sort(key=lambda p: p.price_numeric if p.price_numeric else float('inf'))
    elif sort == "price_high":
        sorted_products.sort(key=lambda p: p.price_numeric if p.price_numeric else 0, reverse=True)
    # For 'name' or default, keep vector search order (sorted by relevance)
    
    # Calculate pagination
    total = len(sorted_products)
    pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    paginated_products = sorted_products[offset:offset + limit]
    
    return ProductList(
        products=paginated_products,
        total=total,
        page=page,
        pages=pages,
        limit=limit
    )


def _database_query_products(
    store: Optional[str],
    category: Optional[str],
    brand: Optional[str],
    sort: str,
    page: int,
    limit: int,
    db: Session,
    search: Optional[str] = None
) -> ProductList:
    """
    Traditional database query for products (fallback or non-search queries)
    """
    # Start with base query
    query = db.query(ProductModel)
    
    # Apply filters
    if store:
        query = query.filter(ProductModel.store == store)
    
    if category:
        query = query.filter(ProductModel.category == category)
    
    if brand:
        query = query.filter(ProductModel.brand == brand)
    
    if search:
        search_filter = or_(
            ProductModel.name.ilike(f"%{search}%"),
            ProductModel.brand.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    # Get total count before pagination
    total = query.count()
    
    # Apply sorting
    if sort == "price_low":
        query = query.order_by(ProductModel.price_numeric.asc())
    elif sort == "price_high":
        query = query.order_by(ProductModel.price_numeric.desc())
    else:  # default to name
        query = query.order_by(func.lower(ProductModel.name).asc())
    
    # Apply pagination
    offset = (page - 1) * limit
    products = query.offset(offset).limit(limit).all()
    
    # Calculate total pages
    pages = math.ceil(total / limit) if total > 0 else 0
    
    return ProductList(
        products=products,
        total=total,
        page=page,
        pages=pages,
        limit=limit
    )


@router.get("/{product_id}", response_model=Product)
def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a single product by ID
    """
    product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product


@router.get("/stores/list", response_model=List[str])
def get_stores(db: Session = Depends(get_db)):
    """
    Get list of all available stores
    """
    stores = db.query(distinct(ProductModel.store)).all()
    return [store[0] for store in stores if store[0]]


@router.get("/categories/list", response_model=List[CategoryCount])
def get_categories(
    store: Optional[str] = Query(None, description="Filter by store"),
    db: Session = Depends(get_db)
):
    """
    Get list of categories with product counts
    """
    query = db.query(
        ProductModel.category,
        func.count(ProductModel.id).label('count')
    )
    
    if store:
        query = query.filter(ProductModel.store == store)
    
    categories = query.group_by(ProductModel.category).order_by(ProductModel.category).all()
    
    return [
        CategoryCount(name=cat[0], count=cat[1])
        for cat in categories
    ]


@router.get("/brands/list", response_model=List[str])
def get_brands(
    store: Optional[str] = Query(None, description="Filter by store"),
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db)
):
    """
    Get list of brands
    """
    query = db.query(distinct(ProductModel.brand))
    
    if store:
        query = query.filter(ProductModel.store == store)
    
    if category:
        query = query.filter(ProductModel.category == category)
    
    brands = query.filter(ProductModel.brand.isnot(None)).order_by(ProductModel.brand).all()
    
    return [brand[0] for brand in brands if brand[0]]
