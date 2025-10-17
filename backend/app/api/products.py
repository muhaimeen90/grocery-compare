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
    Get paginated list of products with filters
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
