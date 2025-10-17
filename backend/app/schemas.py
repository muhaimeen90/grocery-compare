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
