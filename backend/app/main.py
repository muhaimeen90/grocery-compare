"""
FastAPI Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .database import init_db
from .api import products, scraping, cart
from .services.vector_search_service import get_vector_search_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events
    """
    # Startup
    print("🚀 Starting Grocery Price Comparison API...")
    init_db()
    print("✅ Database initialized")
    
    # Initialize vector search service
    vector_service = get_vector_search_service()
    vector_service.initialize()  # Actually initialize the service!
    
    if vector_service.is_available():
        print("✅ Vector search service ready")
    else:
        print("⚠️  Vector search unavailable, will use fallback SQL search")
    
    yield
    
    # Shutdown
    print("👋 Shutting down...")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API for grocery price comparison across IGA, Woolworths, and Coles",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(products.router)
app.include_router(scraping.router)
app.include_router(cart.router)


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Grocery Price Comparison API",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
