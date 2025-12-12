"""Cart API Endpoints"""
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Cart as CartModel, CartItem as CartItemModel, Product as ProductModel
from ..schemas import (
    CartItemCreate,
    CartItem as CartItemSchema,
    CartItemDelete,
    CartItemWithAlternatives,
    Product as ProductSchema,
    ProductWithApproval,
    CompareRequest,
    CompareResponse,
    StoreComparison,
    ProductMatch,
    BestDealItem,
)
from ..services.vector_search_service import get_vector_search_service

router = APIRouter(prefix="/api/v1/cart", tags=["cart"])

STORES = ["IGA", "Woolworths", "Coles"]


def _get_or_create_cart(session_id: str, db: Session) -> CartModel:
    cart = db.query(CartModel).filter(CartModel.session_id == session_id).first()
    if cart:
        return cart

    cart = CartModel(session_id=session_id)
    db.add(cart)
    db.commit()
    db.refresh(cart)
    return cart


@router.post("/items", response_model=CartItemSchema, status_code=status.HTTP_201_CREATED)
def add_cart_item(payload: CartItemCreate, db: Session = Depends(get_db)) -> CartItemSchema:
    """Add or increment a cart item for the provided session"""
    product = db.query(ProductModel).filter(ProductModel.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    cart = _get_or_create_cart(payload.session_id, db)

    cart_item = (
        db.query(CartItemModel)
        .filter(CartItemModel.cart_id == cart.id, CartItemModel.product_id == payload.product_id)
        .first()
    )

    if cart_item:
        cart_item.quantity += payload.quantity
    else:
        cart_item = CartItemModel(
            cart_id=cart.id,
            product_id=payload.product_id,
            quantity=payload.quantity,
        )
        db.add(cart_item)

    db.commit()
    db.refresh(cart_item)
    return cart_item


@router.get("/{session_id}", response_model=List[CartItemWithAlternatives])
def get_cart(session_id: str, db: Session = Depends(get_db)) -> List[CartItemWithAlternatives]:
    """Retrieve full cart contents with cross-store alternatives.
    
    Each alternative product includes:
    - needs_approval: True if user should confirm this is the same product
    - identical_score: Confidence score for the match (0-1)
    - size_matched: True if size exactly matches original
    - brand_matched: True if brand exactly matches original
    """
    cart = db.query(CartModel).filter(CartModel.session_id == session_id).first()
    if not cart:
        return []

    cart_items = (
        db.query(CartItemModel)
        .filter(CartItemModel.cart_id == cart.id)
        .all()
    )

    vector_service = get_vector_search_service()
    response: List[CartItemWithAlternatives] = []

    for item in cart_items:
        product = item.product
        if not product:
            continue

        alternative_schemas: List[ProductWithApproval] = []
        alternative_meta = []
        if vector_service and vector_service.index:
            alternative_meta = vector_service.find_identical_products(product.id, db)

        alt_ids = [alt.get("product_id") for alt in alternative_meta if alt.get("product_id")]
        if alt_ids:
            alternatives = (
                db.query(ProductModel)
                .filter(ProductModel.id.in_(alt_ids))
                .all()
            )
            alt_map = {alt.id: alt for alt in alternatives}
            
            # Build ProductWithApproval schemas with approval metadata
            for meta in alternative_meta:
                pid = meta.get("product_id")
                if pid and pid in alt_map:
                    alt_product = alt_map[pid]
                    alt_schema = ProductWithApproval(
                        **ProductSchema.model_validate(alt_product, from_attributes=True).model_dump(),
                        needs_approval=meta.get('needs_approval', False),
                        identical_score=meta.get('identical_score'),
                        size_matched=meta.get('size_matched', False),
                        brand_matched=meta.get('brand_matched', False),
                        is_fallback=meta.get('is_fallback', False),
                        fallback_type=meta.get('fallback_type'),
                    )
                    alternative_schemas.append(alt_schema)

        product_schema = ProductSchema.model_validate(product, from_attributes=True)

        response.append(
            CartItemWithAlternatives(
                **product_schema.model_dump(),
                cart_item_id=item.id,
                quantity=item.quantity,
                alternative_prices=alternative_schemas,
            )
        )

    return response


@router.delete("/items/{product_id}", response_model=CartItemSchema)
def remove_cart_item(
    product_id: int,
    payload: CartItemDelete,
    db: Session = Depends(get_db),
) -> CartItemSchema:
    """Remove a specific product from the user's cart"""
    cart = db.query(CartModel).filter(CartModel.session_id == payload.session_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    cart_item = (
        db.query(CartItemModel)
        .filter(CartItemModel.cart_id == cart.id, CartItemModel.product_id == product_id)
        .first()
    )
    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    db.delete(cart_item)
    db.commit()
    return cart_item


@router.post("/compare", response_model=CompareResponse)
def compare_cart_items(
    payload: CompareRequest,
    db: Session = Depends(get_db),
) -> CompareResponse:
    """Compare selected cart items across all stores and calculate best deal.
    
    Each matched product includes approval metadata:
    - needs_approval: True if user should confirm this is the same product
    - size_matched: True if size exactly matches original
    - brand_matched: True if brand exactly matches original
    """
    # Validate cart exists
    cart = db.query(CartModel).filter(CartModel.session_id == payload.session_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    # Fetch selected products
    products = (
        db.query(ProductModel)
        .filter(ProductModel.id.in_(payload.product_ids))
        .all()
    )
    
    if not products:
        raise HTTPException(status_code=404, detail="No products found")

    vector_service = get_vector_search_service()
    
    # Build a map of original products
    original_products: Dict[int, ProductModel] = {p.id: p for p in products}
    
    # For each product, find alternatives in ALL stores (including the original store)
    # Structure: {product_id: {store: (ProductModel, metadata_dict)}}
    product_store_map: Dict[int, Dict[str, tuple]] = {}
    
    for product in products:
        # Original product doesn't need approval
        product_store_map[product.id] = {
            product.store: (product, {
                'needs_approval': False,
                'size_matched': True,
                'brand_matched': True,
                'identical_score': 1.0,
            })
        }
        
        # Find similar products in other stores
        if vector_service and vector_service.index:
            similar_meta = vector_service.find_identical_products(product.id, db)
            similar_ids = [m.get("product_id") for m in similar_meta if m.get("product_id")]
            
            # Create a map of product_id to metadata
            meta_map = {m.get("product_id"): m for m in similar_meta if m.get("product_id")}
            
            if similar_ids:
                similar_products = (
                    db.query(ProductModel)
                    .filter(ProductModel.id.in_(similar_ids))
                    .all()
                )
                for sim_product in similar_products:
                    # Only add if we don't have this store yet
                    if sim_product.store not in product_store_map[product.id]:
                        meta = meta_map.get(sim_product.id, {})
                        product_store_map[product.id][sim_product.store] = (sim_product, meta)

    # Build store comparisons
    store_comparisons: List[StoreComparison] = []
    
    for store in STORES:
        store_products: List[ProductMatch] = []
        store_total = 0.0
        available_count = 0
        missing_count = 0
        
        for product_id, store_map in product_store_map.items():
            original = original_products[product_id]
            original_schema = ProductSchema.model_validate(original, from_attributes=True)
            
            if store in store_map:
                matched, meta = store_map[store]
                matched_schema = ProductSchema.model_validate(matched, from_attributes=True)
                price = matched.price_numeric or 0.0
                store_total += price
                available_count += 1
                store_products.append(ProductMatch(
                    original_product=original_schema,
                    matched_product=matched_schema,
                    is_available=True,
                    similarity_score=meta.get('identical_score'),
                    needs_approval=meta.get('needs_approval', False),
                    size_matched=meta.get('size_matched', True),
                    brand_matched=meta.get('brand_matched', True),
                    is_fallback=meta.get('is_fallback', False),
                    fallback_type=meta.get('fallback_type'),
                ))
            else:
                missing_count += 1
                store_products.append(ProductMatch(
                    original_product=original_schema,
                    matched_product=None,
                    is_available=False,
                ))
        
        store_comparisons.append(StoreComparison(
            store=store,
            products=store_products,
            total=round(store_total, 2),
            available_count=available_count,
            missing_count=missing_count,
        ))

    # Calculate best deal - find cheapest option for each product across all stores
    best_deal_items: List[BestDealItem] = []
    best_deal_total = 0.0
    original_total = 0.0
    
    for product_id, store_map in product_store_map.items():
        original = original_products[product_id]
        original_schema = ProductSchema.model_validate(original, from_attributes=True)
        original_price = original.price_numeric or 0.0
        original_total += original_price
        
        # Find the cheapest option across all stores
        best_product = None
        best_price = float('inf')
        best_store = ""
        
        for store, (prod, meta) in store_map.items():
            price = prod.price_numeric or float('inf')
            if price < best_price:
                best_price = price
                best_product = prod
                best_store = store
        
        if best_product:
            best_schema = ProductSchema.model_validate(best_product, from_attributes=True)
            savings = max(0, original_price - best_price)
            best_deal_total += best_price
            
            best_deal_items.append(BestDealItem(
                original_product=original_schema,
                best_product=best_schema,
                store=best_store,
                price=round(best_price, 2),
                savings=round(savings, 2),
            ))

    total_savings = max(0, original_total - best_deal_total)
    
    return CompareResponse(
        store_comparisons=store_comparisons,
        best_deal=best_deal_items,
        best_deal_total=round(best_deal_total, 2),
        best_deal_savings=round(total_savings, 2),
    )
