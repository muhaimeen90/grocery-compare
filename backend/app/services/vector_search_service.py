"""
Vector Search Service using Pinecone for hybrid product search (semantic + keyword)
"""
from typing import List, Dict, Optional, Any
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
from pinecone_text.sparse import BM25Encoder
import os
from ..config import settings
import time
import traceback
from pathlib import Path


class VectorSearchService:
    """Service for performing hybrid search (semantic + keyword) on products using Pinecone"""
    
    def __init__(self):
        """Initialize the vector search service"""
        self.model = None
        self.bm25_encoder = None
        self.pinecone_client = None
        self.index = None
        self.index_name = "grocery-hybrid"
        self._initialize()
    
    def _initialize(self):
        """Initialize Pinecone, embedding model, and BM25 encoder"""
        try:
            print("🤖 Loading embedding model (dense vectors)...")
            # Initialize embedding model for dense vectors
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            print("✅ Dense model loaded")
            
            # Initialize BM25 encoder for sparse vectors
            print("🔤 Loading BM25 encoder (sparse vectors)...")
            bm25_path = Path(__file__).parent.parent.parent / "bm25_params.json"
            if bm25_path.exists():
                self.bm25_encoder = BM25Encoder.default()
                self.bm25_encoder.load(str(bm25_path))
                print("✅ BM25 encoder loaded from saved parameters")
            else:
                print("⚠️  BM25 parameters not found - using default encoder")
                print("   Run migration script first to generate bm25_params.json")
                self.bm25_encoder = BM25Encoder.default()
            
            # Initialize Pinecone
            api_key = settings.PINECONE_API_KEY or os.getenv("PINECONE_API_KEY")
            if not api_key:
                raise ValueError("PINECONE_API_KEY not found in settings or environment")
            
            print("🔌 Connecting to Pinecone...")
            self.pinecone_client = Pinecone(api_key=api_key)
            self.index = self.pinecone_client.Index(self.index_name)
            print("✅ Pinecone connected (HYBRID search enabled)")
            
            # Test the connection
            stats = self.index.describe_index_stats()
            print(f"✅ Index stats: {stats.get('total_vector_count', 0):,} vectors")
            
        except Exception as e:
            print(f"❌ Failed to initialize vector search: {e}")
            traceback.print_exc()
            # Don't raise exception - allow app to run without vector search
    
    def is_available(self) -> bool:
        """Check if hybrid search is available"""
        return self.model is not None and self.bm25_encoder is not None and self.index is not None
    
    def encode_query(self, query: str) -> tuple[List[float], Dict[str, Any]]:
        """
        Convert search query to both dense and sparse vectors for hybrid search
        
        Args:
            query: Search query string
            
        Returns:
            Tuple of (dense_vector, sparse_vector_dict)
        """
        if not self.model or not self.bm25_encoder:
            raise RuntimeError("Embedding models not initialized")
        
        start = time.time()
        
        # Generate dense vector (semantic)
        dense_vector = self.model.encode(query, show_progress_bar=False)
        
        # Generate sparse vector (keyword-based)
        sparse_vector = self.bm25_encoder.encode_queries(query)
        
        elapsed = time.time() - start
        print(f"  🔢 Hybrid encoding took {elapsed:.3f}s")
        
        return dense_vector.tolist(), sparse_vector
    
    def search(
        self,
        query: str,
        top_k: int = 20,
        score_threshold: float = 0.5,
        filters: Optional[Dict[str, Any]] = None,
        alpha: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Perform HYBRID search on products (semantic + keyword matching)
        
        Args:
            query: Search query string
            top_k: Number of results to return
            score_threshold: Minimum similarity score (0-1)
            filters: Metadata filters (e.g., {"category": "Beverages", "store": "IGA"})
            alpha: Balance between dense (1.0) and sparse (0.0) search
                   0.0 = pure keyword search (BM25)
                   1.0 = pure semantic search
                   0.5 = balanced hybrid (recommended)
            
        Returns:
            List of product dictionaries with metadata and scores
        """
        print(f"\n🔍 HYBRID search called: query='{query}', top_k={top_k}, threshold={score_threshold}, alpha={alpha}")
        
        if not self.is_available():
            print("❌ Hybrid search not available")
            return []
        
        if not query or not query.strip():
            print("❌ Empty query")
            return []
        
        try:
            total_start = time.time()
            
            # Generate both dense and sparse embeddings for the query
            print("  📝 Encoding query (dense + sparse)...")
            dense_vector, sparse_vector = self.encode_query(query)
            
            # Prepare filter dictionary for Pinecone
            # Only include non-None filters
            pinecone_filter = {}
            if filters:
                for key, value in filters.items():
                    if value is not None and value != "":
                        pinecone_filter[key] = value
            
            # Perform HYBRID search in Pinecone
            search_params = {
                "vector": dense_vector,
                "sparse_vector": sparse_vector,
                "top_k": top_k,
                "include_metadata": True,
                "alpha": alpha  # Hybrid search balance
            }
            
            # Add filter if present
            if pinecone_filter:
                search_params["filter"] = pinecone_filter
                print(f"  🔧 Filters applied: {pinecone_filter}")
            
            print(f"  🚀 Querying Pinecone (hybrid: {int(alpha*100)}% semantic, {int((1-alpha)*100)}% keyword)...")
            query_start = time.time()
            
            results = self.index.query(**search_params)
            
            query_elapsed = time.time() - query_start
            print(f"  ✅ Pinecone hybrid query completed in {query_elapsed:.3f}s")
            
            # Extract and format results
            products = []
            for match in results.get('matches', []):
                # Filter by score threshold
                if match['score'] >= score_threshold:
                    product_data = match['metadata'].copy()
                    product_data['similarity_score'] = match['score']
                    product_data['id'] = product_data.get('product_id')
                    products.append(product_data)
            
            total_elapsed = time.time() - total_start
            print(f"  ✅ Found {len(products)} products (total time: {total_elapsed:.3f}s)")
            
            return products
            
        except Exception as e:
            print(f"❌ Error performing hybrid search: {e}")
            print(f"❌ Error type: {type(e).__name__}")
            traceback.print_exc()
            return []
    
    def search_with_category(
        self,
        query: str,
        category: Optional[str] = None,
        store: Optional[str] = None,
        brand: Optional[str] = None,
        top_k: int = 20,
        score_threshold: float = 0.5,
        alpha: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search with category and store filtering
        
        Args:
            query: Search query string
            category: Optional category filter
            store: Optional store filter
            brand: Optional brand filter
            top_k: Number of results to return
            score_threshold: Minimum similarity score
            alpha: Hybrid search balance (0.0=keyword, 1.0=semantic, 0.5=balanced)
            
        Returns:
            List of product dictionaries
        """
        filters = {}
        if category:
            filters['category'] = category
        if store:
            filters['store'] = store
        if brand:
            filters['brand'] = brand
        
        return self.search(
            query=query,
            top_k=top_k,
            score_threshold=score_threshold,
            filters=filters if filters else None,
            alpha=alpha
        )


# Global instance
_vector_search_service = None


def get_vector_search_service() -> VectorSearchService:
    """Get or create the global vector search service instance"""
    global _vector_search_service
    if _vector_search_service is None:
        _vector_search_service = VectorSearchService()
    return _vector_search_service
