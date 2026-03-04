"""Cart API Endpoints"""
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

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
    SingleStoreOption,
    TwoStoreOption,
    TravelInfo,
)
from ..services.vector_search_service import get_vector_search_service
from ..services.travel_cost_service import compute_all_travel_costs, TravelCostResult

router = APIRouter(prefix="/api/v1/cart", tags=["cart"])

STORES = ["IGA", "Woolworths", "Coles", "Aldi"]


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
    product = db.query(ProductModel).options(joinedload(ProductModel.store_rel)).filter(ProductModel.id == payload.product_id).first()
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
                .options(joinedload(ProductModel.store_rel))
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
        .options(joinedload(ProductModel.store_rel))
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
        store_name = product.store_rel.name if product.store_rel else "Unknown"
        product_store_map[product.id] = {
            store_name: (product, {
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
            
            print(f"\n🔍 DEBUG: Product {product.id}")
            print(f"  Similar IDs from vector search: {similar_ids}")
            
            # Create a map of product_id to metadata
            meta_map = {m.get("product_id"): m for m in similar_meta if m.get("product_id")}
            
            if similar_ids:
                similar_products = (
                    db.query(ProductModel)
                    .options(joinedload(ProductModel.store_rel))
                    .filter(ProductModel.id.in_(similar_ids))
                    .all()
                )
                print(f"  Products fetched from DB: {len(similar_products)}")
                for sp in similar_products:
                    store_name = sp.store_rel.name if sp.store_rel else "Unknown"
                    print(f"    - ID {sp.id}: {sp.name[:40]} ({store_name})")
                
                for sim_product in similar_products:
                    sim_store_name = sim_product.store_rel.name if sim_product.store_rel else "Unknown"
                    # Only add if we don't have this store yet
                    if sim_store_name not in product_store_map[product.id]:
                        meta = meta_map.get(sim_product.id, {})
                        product_store_map[product.id][sim_store_name] = (sim_product, meta)
                        print(f"    ✅ Added {sim_store_name} to map")
                    else:
                        print(f"    ⏭️  {sim_store_name} already in map")

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
                
                # Determine mismatch reason
                mismatch_reason = None
                if not meta.get('size_matched', True) and not meta.get('brand_matched', True):
                    mismatch_reason = "Brand and size differ"
                elif not meta.get('size_matched', True):
                    mismatch_reason = "Size differs"
                elif not meta.get('brand_matched', True):
                    mismatch_reason = "Brand differs"
                
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
                    mismatch_reason=mismatch_reason,
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
            
            # Get metadata for mismatch reason
            best_meta = store_map.get(best_store, (None, {}))[1]
            mismatch_reason = None
            if not best_meta.get('size_matched', True) and not best_meta.get('brand_matched', True):
                mismatch_reason = "Brand and size differ"
            elif not best_meta.get('size_matched', True):
                mismatch_reason = "Size differs"
            elif not best_meta.get('brand_matched', True):
                mismatch_reason = "Brand differs"
            
            best_deal_items.append(BestDealItem(
                original_product=original_schema,
                best_product=best_schema,
                store=best_store,
                price=round(best_price, 2),
                savings=round(savings, 2),
                mismatch_reason=mismatch_reason,
            ))

    total_savings = max(0, original_total - best_deal_total)
    
    # ========== TRAVEL COST INTEGRATION ==========
    # Build travel costs if user provided location + transport mode
    travel_data = None  # {single_store: {name: TravelCostResult}, two_store: {(a,b): TravelCostResult}}
    has_travel = (
        payload.user_lat is not None
        and payload.user_lng is not None
        and payload.transport_mode is not None
        and payload.store_locations is not None
        and len(payload.store_locations) > 0
    )
    
    if has_travel:
        user_coords = (payload.user_lat, payload.user_lng)
        gm_mode = "transit" if payload.transport_mode == "public" else "driving"
        
        store_coords_map = {
            sl.store_name: (sl.lat, sl.lng)
            for sl in payload.store_locations
        }
        
        travel_data = compute_all_travel_costs(user_coords, store_coords_map, gm_mode)
    
    def _travel_result_to_schema(tr: TravelCostResult) -> TravelInfo:
        return TravelInfo(
            distance_km=tr.distance_km,
            duration_min=tr.duration_min,
            fuel_or_fare_cost=tr.fuel_or_fare_cost,
            time_cost=tr.time_cost,
            total_cost=tr.total_cost,
            route_description=tr.route_description,
            mode=tr.mode,
        )
    
    # Attach travel info to each store comparison
    for sc in store_comparisons:
        if travel_data and sc.store in travel_data["single_store"]:
            tr = travel_data["single_store"][sc.store]
            sc.travel_info = _travel_result_to_schema(tr)
            sc.total_with_travel = round(sc.total + tr.total_cost, 2)
        else:
            sc.total_with_travel = sc.total
    
    # Calculate best single store — use total_with_travel if available
    best_single_store = min(store_comparisons, key=lambda x: x.total_with_travel or x.total)
    
    best_single_travel_info = None
    best_single_total_with_travel = None
    if travel_data and best_single_store.store in travel_data["single_store"]:
        tr = travel_data["single_store"][best_single_store.store]
        best_single_travel_info = _travel_result_to_schema(tr)
        best_single_total_with_travel = round(best_single_store.total + tr.total_cost, 2)
    
    # Calculate best two-store combination
    # Try all pairs of stores and find the cheapest combination
    from itertools import combinations
    
    best_two_store_total = float('inf')
    best_two_store_product_total = 0.0
    best_two_store_stores = []
    best_two_store_products = []
    best_two_store_travel = None
    
    for store1, store2 in combinations(STORES, 2):
        two_store_products: List[ProductMatch] = []
        two_store_total = 0.0
        two_store_available = 0
        two_store_missing = 0
        
        for product_id, store_map in product_store_map.items():
            original = original_products[product_id]
            original_schema = ProductSchema.model_validate(original, from_attributes=True)
            
            # Find cheapest option between the two stores
            best_in_pair = None
            best_price_in_pair = float('inf')
            best_store_in_pair = ""
            best_meta_in_pair = {}
            
            for store in [store1, store2]:
                if store in store_map:
                    prod, meta = store_map[store]
                    price = prod.price_numeric or float('inf')
                    if price < best_price_in_pair:
                        best_price_in_pair = price
                        best_in_pair = prod
                        best_store_in_pair = store
                        best_meta_in_pair = meta
            
            if best_in_pair:
                matched_schema = ProductSchema.model_validate(best_in_pair, from_attributes=True)
                two_store_total += best_price_in_pair
                two_store_available += 1
                
                # Determine mismatch reason
                mismatch_reason = None
                if not best_meta_in_pair.get('size_matched', True) and not best_meta_in_pair.get('brand_matched', True):
                    mismatch_reason = "Brand and size differ"
                elif not best_meta_in_pair.get('size_matched', True):
                    mismatch_reason = "Size differs"
                elif not best_meta_in_pair.get('brand_matched', True):
                    mismatch_reason = "Brand differs"
                
                two_store_products.append(ProductMatch(
                    original_product=original_schema,
                    matched_product=matched_schema,
                    is_available=True,
                    similarity_score=best_meta_in_pair.get('identical_score'),
                    needs_approval=best_meta_in_pair.get('needs_approval', False),
                    size_matched=best_meta_in_pair.get('size_matched', True),
                    brand_matched=best_meta_in_pair.get('brand_matched', True),
                    is_fallback=best_meta_in_pair.get('is_fallback', False),
                    fallback_type=best_meta_in_pair.get('fallback_type'),
                    mismatch_reason=mismatch_reason,
                ))
            else:
                two_store_missing += 1
                two_store_products.append(ProductMatch(
                    original_product=original_schema,
                    matched_product=None,
                    is_available=False,
                ))
        
        # Check if this pair is better than the current best
        # Use travel-adjusted total when available
        pair_key = tuple(sorted([store1, store2]))
        travel_cost_for_pair = 0.0
        pair_travel_info = None
        if travel_data:
            for tk, tv in travel_data["two_store"].items():
                if set(tk) == set([store1, store2]):
                    travel_cost_for_pair = tv.total_cost
                    pair_travel_info = tv
                    break
        
        effective_total = two_store_total + travel_cost_for_pair
        
        if effective_total < best_two_store_total:
            best_two_store_total = effective_total
            best_two_store_product_total = two_store_total
            best_two_store_stores = [store1, store2]
            best_two_store_products = two_store_products
            best_two_store_travel = pair_travel_info
    
    # Build the best two-store option
    two_store_travel_info = None
    two_store_total_with_travel = None
    if best_two_store_travel:
        two_store_travel_info = _travel_result_to_schema(best_two_store_travel)
        two_store_total_with_travel = round(best_two_store_product_total + best_two_store_travel.total_cost, 2)
    
    best_two_stores_option = TwoStoreOption(
        stores=best_two_store_stores,
        products=best_two_store_products,
        total=round(best_two_store_product_total, 2),
        available_count=sum(1 for p in best_two_store_products if p.is_available),
        missing_count=sum(1 for p in best_two_store_products if not p.is_available),
        travel_info=two_store_travel_info,
        total_with_travel=two_store_total_with_travel,
    )
    
    # Build recommendation text
    recommendation = None
    if has_travel:
        single_eff = best_single_total_with_travel or best_single_store.total
        two_eff = two_store_total_with_travel or best_two_store_product_total
        
        mode_label = "public transit" if payload.transport_mode == "public" else "driving"
        
        if single_eff <= two_eff:
            savings = round(two_eff - single_eff, 2)
            recommendation = (
                f"🏆 Shopping at {best_single_store.store} is your cheapest option "
                f"(${single_eff:.2f} total incl. {mode_label} travel). "
                f"You save ${savings:.2f} compared to the two-store option."
            )
        else:
            savings = round(single_eff - two_eff, 2)
            recommendation = (
                f"🏆 Shopping at {' + '.join(best_two_store_stores)} is cheapest "
                f"(${two_eff:.2f} total incl. {mode_label} travel). "
                f"You save ${savings:.2f} compared to the single-store option."
            )
    
    return CompareResponse(
        store_comparisons=store_comparisons,
        best_deal=best_deal_items,
        best_deal_total=round(best_deal_total, 2),
        best_deal_savings=round(total_savings, 2),
        best_single_store=SingleStoreOption(
            store=best_single_store.store,
            products=best_single_store.products,
            total=best_single_store.total,
            available_count=best_single_store.available_count,
            missing_count=best_single_store.missing_count,
            travel_info=best_single_travel_info,
            total_with_travel=best_single_total_with_travel,
        ),
        best_two_stores=best_two_stores_option,
        transport_mode=payload.transport_mode if has_travel else None,
        recommendation=recommendation,
    )
