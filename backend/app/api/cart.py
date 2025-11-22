"""Cart API Endpoints"""
from typing import List
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
)
from ..services.vector_search_service import get_vector_search_service

router = APIRouter(prefix="/api/v1/cart", tags=["cart"])


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
    """Retrieve full cart contents with cross-store alternatives"""
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

        alternative_products: List[ProductModel] = []
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
            for meta in alternative_meta:
                pid = meta.get("product_id")
                if pid and pid in alt_map:
                    alternative_products.append(alt_map[pid])

        product_schema = ProductSchema.model_validate(product, from_attributes=True)
        alternative_schemas = [
            ProductSchema.model_validate(alt, from_attributes=True)
            for alt in alternative_products
        ]

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
