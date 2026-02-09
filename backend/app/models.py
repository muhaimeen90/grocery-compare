"""
SQLAlchemy Database Models
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index, ForeignKey, Boolean, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


class Store(Base):
    """Store chain model (IGA, Woolworths, Coles, Aldi)"""
    __tablename__ = "stores"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)  # "Aldi", "Coles", "IGA", "Woolworths"
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    locations = relationship("Location", back_populates="store", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="store_rel")
    
    def __repr__(self):
        return f"<Store(id={self.id}, name={self.name})>"


class Location(Base):
    """Individual store location/branch"""
    __tablename__ = "locations"
    
    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Store identification
    external_store_id = Column(String, index=True)  # Original store_id from CSV
    name = Column(String, nullable=False)
    
    # Address fields
    address = Column(String)  # Combined or primary address line
    suburb = Column(String, index=True)
    state = Column(String, index=True)
    postcode = Column(String, index=True)
    
    # Geolocation
    latitude = Column(Numeric(precision=10, scale=8), index=True)
    longitude = Column(Numeric(precision=11, scale=8), index=True)
    
    # Contact and operational info
    phone = Column(String)
    opening_hours = Column(Text)  # Store as text for now
    is_active = Column(Boolean, default=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    store = relationship("Store", back_populates="locations")
    carts = relationship("Cart", back_populates="location")
    
    # Indexes
    __table_args__ = (
        Index('idx_store_state_postcode', 'store_id', 'state', 'postcode'),
        Index('idx_location_coords', 'latitude', 'longitude'),
    )
    
    def __repr__(self):
        return f"<Location(id={self.id}, name={self.name}, store_id={self.store_id})>"


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
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True)
    product_url = Column(Text)
    image_url = Column(Text)
    last_scraped = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    store_rel = relationship("Store", back_populates="products")
    
    # Create composite indexes for common queries
    __table_args__ = (
        Index('idx_store_id_category', 'store_id', 'category'),
        Index('idx_store_id_brand', 'store_id', 'brand'),
    )
    
    def __repr__(self):
        return f"<Product(id={self.id}, name={self.name}, store_id={self.store_id}, price={self.price})>"


class Cart(Base):
    """Shopping cart model keyed by client session"""

    __tablename__ = "carts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, nullable=False, index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True, index=True)  # Optional location association
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")
    location = relationship("Location", back_populates="carts")

    def __repr__(self) -> str:
        return f"<Cart(id={self.id}, session_id={self.session_id}, location_id={self.location_id})>"


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
