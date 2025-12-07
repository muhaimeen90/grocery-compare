"""
SQLAlchemy Database Models
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


class Product(Base):
    """Product model"""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(String, nullable=False)  # Raw price string (e.g., "$12.99")
    price_numeric = Column(Float, index=True)  # Numeric for sorting
    brand = Column(String, index=True)
    size = Column(String, nullable=True)  # Product size (e.g., "500g", "1L")
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


class Cart(Base):
    """Shopping cart model keyed by client session"""

    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Cart(id={self.id}, session_id={self.session_id})>"


class CartItem(Base):
    """Individual cart line item"""

    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    cart_id = Column(Integer, ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    cart = relationship("Cart", back_populates="items")
    product = relationship("Product")

    __table_args__ = (
        Index("idx_cart_product_unique", "cart_id", "product_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<CartItem(id={self.id}, cart_id={self.cart_id}, product_id={self.product_id}, quantity={self.quantity})>"
