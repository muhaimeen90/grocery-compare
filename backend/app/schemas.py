"""
Pydantic Schemas for Request/Response validation
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ProductBase(BaseModel):
    """Base product schema"""
    name: str
    price: str
    brand: Optional[str] = None
    size: Optional[str] = None
    category: str
    store: str
    product_url: Optional[str] = None
    image_url: Optional[str] = None


class ProductCreate(ProductBase):
    """Schema for creating a product"""
    price_numeric: Optional[float] = None


class Product(ProductBase):
    """Schema for product response"""
    id: int
    price_numeric: Optional[float] = None
    last_scraped: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProductList(BaseModel):
    """Schema for paginated product list"""
    products: List[Product]
    total: int
    page: int
    pages: int
    limit: int


class CategoryCount(BaseModel):
    """Schema for category with product count"""
    name: str
    count: int


class ScrapeRequest(BaseModel):
    """Schema for single product scrape request"""
    product_id: int


class BatchScrapeRequest(BaseModel):
    """Schema for batch scrape request"""
    product_ids: List[int] = Field(..., max_length=10)


class ScrapeResponse(BaseModel):
    """Schema for scrape response"""
    task_id: str
    status: str
    product_id: Optional[int] = None
    total: Optional[int] = None


class ScrapeStatus(BaseModel):
    """Schema for scrape status"""
    task_id: str
    status: str  # 'pending', 'scraping', 'success', 'error'
    price: Optional[str] = None
    message: Optional[str] = None
    product_id: Optional[int] = None
    completed_at: Optional[datetime] = None
    product: Optional[Product] = None  # Full product data on success


class CartBase(BaseModel):
    """Base cart schema"""
    session_id: str = Field(..., min_length=1)


class Cart(CartBase):
    """Cart response schema"""
    id: int

    class Config:
        from_attributes = True


class CartItemBase(BaseModel):
    """Base cart item schema"""
    product_id: int
    quantity: int = Field(default=1, ge=1)


class CartItemCreate(CartItemBase):
    """Schema for adding cart items"""
    session_id: str = Field(..., min_length=1)


class CartItemDelete(BaseModel):
    """Schema for deleting cart items"""
    session_id: str = Field(..., min_length=1)


class CartItem(CartItemBase):
    """Cart item response schema"""
    id: int
    cart_id: int

    class Config:
        from_attributes = True


class ProductWithApproval(Product):
    """Product schema with approval status for identical product matching"""
    needs_approval: bool = False  # True if user should confirm this is the same product
    identical_score: Optional[float] = None  # Score from identical product matching (0-1)
    size_matched: bool = False  # True if size exactly matches original
    brand_matched: bool = False  # True if brand exactly matches original
    is_fallback: bool = False  # True if this is a fallback alternative (not primary match)
    fallback_type: Optional[str] = None  # Type: 'same_brand_diff_size' or 'same_size_diff_brand'


class CartItemWithAlternatives(Product):
    """Product schema augmented with cart info and alternative matches"""
    cart_item_id: int
    quantity: int = Field(default=1, ge=1)
    alternative_prices: List[ProductWithApproval] = Field(default_factory=list)


# ============== Cart Comparison Schemas ==============

class CompareRequest(BaseModel):
    """Schema for cart comparison request"""
    product_ids: List[int] = Field(..., min_length=1, description="List of product IDs to compare")
    session_id: str = Field(..., min_length=1)


class ProductMatch(BaseModel):
    """A product match for comparison - either found or missing"""
    original_product: Product
    matched_product: Optional[Product] = None
    is_available: bool = True
    similarity_score: Optional[float] = None
    needs_approval: bool = False  # True if user should confirm this match
    size_matched: bool = False  # True if size exactly matches original
    brand_matched: bool = False  # True if brand exactly matches original
    is_fallback: bool = False  # True if this is a fallback alternative (not primary match)
    fallback_type: Optional[str] = None  # Type: 'same_brand_diff_size' or 'same_size_diff_brand'
    mismatch_reason: Optional[str] = None  # Human-readable reason for mismatch (e.g., "Brand differs", "Size differs")


class StoreComparison(BaseModel):
    """Comparison data for a single store"""
    store: str
    products: List[ProductMatch]
    total: float
    available_count: int
    missing_count: int


class BestDealItem(BaseModel):
    """An item in the best deal calculation"""
    original_product: Product
    best_product: Product
    store: str
    price: float
    savings: float = 0.0  # Savings compared to original
    mismatch_reason: Optional[str] = None  # Reason for mismatch if substitute used


class SingleStoreOption(BaseModel):
    """Best single-store shopping option"""
    store: str
    products: List[ProductMatch]
    total: float
    available_count: int
    missing_count: int


class TwoStoreOption(BaseModel):
    """Best two-store combination shopping option"""
    stores: List[str]  # Two store names
    products: List[ProductMatch]  # Each product shows which store it comes from
    total: float
    available_count: int
    missing_count: int


class CompareResponse(BaseModel):
    """Response schema for cart comparison"""
    store_comparisons: List[StoreComparison]
    best_deal: List[BestDealItem]
    best_deal_total: float
    best_deal_savings: float
    best_single_store: SingleStoreOption
    best_two_stores: TwoStoreOption
