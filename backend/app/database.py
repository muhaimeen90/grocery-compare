"""
Database configuration and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path
from .config import settings

# Ensure data directory exists
DATA_DIR = Path(settings.DATABASE_URL.replace('sqlite:///', '').replace('/grocery_prices.db', ''))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()


def get_db():
    """Dependency for getting database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - create all tables"""
    from .models import Product  # Import models to register them
    Base.metadata.create_all(bind=engine)
