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
    DEBUG: bool = False  # Set to False in production
    
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
    
    # Pinecone
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "grocery-products"
    
    # Vector Search Settings
    VECTOR_SEARCH_TOP_K: int = 50
    VECTOR_SEARCH_SCORE_THRESHOLD: float = 0.6
    VECTOR_SEARCH_ALPHA: float = 0.35  # 35% semantic, 65% keyword for better exact matching
    
    # Search Ranking Weights
    RANKING_EXACT_MATCH_BONUS: float = 100.0  # Bonus for exact phrase match
    RANKING_WORD_OVERLAP_WEIGHT: float = 50.0  # Weight for word overlap percentage
    RANKING_BRAND_MATCH_WEIGHT: float = 30.0  # Weight for brand match in query
    RANKING_VECTOR_WEIGHT: float = 20.0  # Weight for vector similarity score
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    
    class Config:
        env_file = ".env"


settings = Settings()
