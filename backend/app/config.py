"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Grocery Price Comparison API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/grocery_prices.db"
    
    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",
        "https://*.onrender.com",
    ]
    
    # Scraping
    MAX_CONCURRENT_SCRAPES: int = 5
    SCRAPE_TIMEOUT: int = 30
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    CSV_DIR: Path = BASE_DIR.parent / "week 2"
    
    class Config:
        env_file = ".env"


settings = Settings()
