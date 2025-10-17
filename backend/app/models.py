"""
SQLAlchemy Database Models
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index
from sqlalchemy.sql import func
from .database import Base


class Product(Base):
    """Product model"""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(String, nullable=False)  # Raw price string (e.g., "$12.99")
    price_numeric = Column(Float, index=True)  # Numeric for sorting
    brand = Column(String, index=True)
    category = Column(String, nullable=False, index=True)
    store = Column(String, nullable=False, index=True)  # 'IGA', 'Woolworths', 'Coles'
    product_url = Column(Text)
    image_url = Column(Text)
    last_scraped = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Create composite indexes for common queries
    __table_args__ = (
        Index('idx_store_category', 'store', 'category'),
        Index('idx_store_brand', 'store', 'brand'),
    )
    
    def __repr__(self):
        return f"<Product(id={self.id}, name={self.name}, store={self.store}, price={self.price})>"
