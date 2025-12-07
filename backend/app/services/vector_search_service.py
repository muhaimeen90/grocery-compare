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
from sqlalchemy.orm import Session
from ..models import Product as ProductModel
from ..utils.ranking_utils import rank_identical_products


class VectorSearchService:
    """Service for performing hybrid search (semantic + keyword) on products using Pinecone"""
    
    def __init__(self):
        """Initialize the vector search service"""
        self.pc = None
        self.index = None
        self.model = None
        self.bm25_encoder = None
        self._initialized = False
        self._init_error = None
    
    def initialize(self):
        """Initialize Pinecone, embedding model, and BM25 encoder"""
        if self._initialized:
            return
        
        try:
            import os
            from dotenv import load_dotenv
            from pinecone import Pinecone
            from sentence_transformers import SentenceTransformer
            from pinecone_text.sparse import BM25Encoder
            from pathlib import Path
            
            load_dotenv()
            
            # Get API key
            api_key = os.getenv("PINECONE_API_KEY")
            if not api_key:
                raise ValueError("PINECONE_API_KEY not found in environment variables")
            
            # Initialize Pinecone
            print("🔌 Initializing Pinecone connection...")
            self.pc = Pinecone(api_key=api_key)
            self.index = self.pc.Index("grocery-hybrid")
            print("✅ Connected to grocery-hybrid index")
            
            # Load embedding model
            print("🤖 Loading sentence transformer model...")
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            print("✅ Embedding model loaded")
            
            # Load BM25 encoder from saved parameters (NOT fitting from scratch)
            print("🔤 Loading BM25 encoder parameters...")
            bm25_params_path = Path(__file__).parent.parent.parent / "bm25_params.json"
            
            if not bm25_params_path.exists():
                print("⚠️  BM25 parameters file not found. Hybrid search will use dense vectors only.")
                print(f"   Expected location: {bm25_params_path}")
                self.bm25_encoder = None
            else:
                # Use BM25Encoder() directly instead of BM25Encoder.default()
                # .default() tries to download NLTK tokenizers which can hang
                # Loading from params file provides the tokenizer config
                self.bm25_encoder = BM25Encoder()
                self.bm25_encoder.load(str(bm25_params_path))
                print("✅ BM25 encoder loaded from pre-fitted parameters")
            
            self._initialized = True
            print("🎉 Vector search service initialized successfully")
            
        except Exception as e:
            self._init_error = str(e)
            print(f"❌ Failed to initialize vector search service: {e}")
            import traceback
            traceback.print_exc()
    
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

    def find_identical_products(self, product_id: int, db: Session) -> List[Dict[str, Any]]:
        """Find highly similar products from other stores using hybrid search (vector + keyword)
        with strict size and brand matching for accurate price comparison.
        
        Returns one best match per store with approval status based on size/brand match.
        Products above the auto-approve threshold are considered identical.
        Products below the threshold but above minimum are returned with needs_approval=True.
        """
        if not self.index:
            print("⚠️  Vector index not initialized for identical product search")
            return []
        
        print(f"\n🔍 Finding identical products for product_id={product_id}...")

        # Fetch original product to know its store and ensure it exists
        original_product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
        if not original_product:
            print(f"⚠️  Product {product_id} not found in database")
            return []
        
        print(f"  Original: {original_product.name[:60]} ({original_product.store})")
        print(f"  Size: {original_product.size}, Brand: {original_product.brand}")

        # Generate query vectors from product name for hybrid search
        try:
            dense_vector, sparse_vector = self.encode_query(original_product.name)
        except Exception as e:
            print(f"❌ Failed to encode query for product {product_id}: {e}")
            return []

        try:
            # Use hybrid search with alpha=0.3 to favor keywords slightly more
            # Fetch more candidates (top_k=15) to have enough for re-ranking
            results = self.index.query(
                vector=dense_vector,
                sparse_vector=sparse_vector,
                top_k=15,
                include_metadata=True,
                filter={"store": {"$ne": original_product.store}},
                alpha=0.3 
            )
        except Exception as query_error:
            print(f"❌ Failed to query Pinecone for identical products: {query_error}")
            return []

        # Collect all candidates from vector search (lower threshold to get more candidates)
        candidates = []
        for match in results.get("matches", []):
            score = match.get("score", 0)
            
            # Use a lower threshold here - the re-ranking will filter properly
            if score < 0.40:
                continue
                
            metadata = (match.get("metadata") or {}).copy()
            if not metadata:
                continue

            # Ensure we always have a product_id in the metadata payload
            if "product_id" not in metadata:
                match_id = match.get("id")
                if isinstance(match_id, str) and match_id.startswith("product_"):
                    try:
                        metadata["product_id"] = int(match_id.replace("product_", ""))
                    except ValueError:
                        pass

            metadata["similarity_score"] = score
            candidates.append(metadata)
        
        print(f"  📊 Vector search returned {len(candidates)} candidates")
        
        if not candidates:
            return []
        
        # Re-rank candidates using strict size/brand matching
        original_data = {
            'size': original_product.size,
            'brand': original_product.brand,
            'store': original_product.store,
        }
        
        ranked_matches = rank_identical_products(
            original_product=original_data,
            candidates=candidates,
            size_match_bonus=settings.IDENTICAL_SIZE_MATCH_BONUS,
            brand_match_bonus=settings.IDENTICAL_BRAND_MATCH_BONUS,
            size_mismatch_penalty=settings.IDENTICAL_SIZE_MISMATCH_PENALTY,
            brand_mismatch_penalty=settings.IDENTICAL_BRAND_MISMATCH_PENALTY,
            auto_approve_threshold=settings.IDENTICAL_AUTO_APPROVE_THRESHOLD,
            minimum_score=settings.IDENTICAL_MINIMUM_SCORE,
        )
        
        for match in ranked_matches:
            status = "✅ AUTO" if not match.get('needs_approval') else "⚠️ NEEDS APPROVAL"
            print(f"  {status}: {match.get('name', 'N/A')[:50]} from {match.get('store')} "
                  f"(score: {match.get('identical_score', 0):.3f}, "
                  f"size_match: {match.get('size_matched')}, brand_match: {match.get('brand_matched')})")
        
        print(f"  📊 Total matches after re-ranking: {len(ranked_matches)}\n")
        return ranked_matches


# Global instance
_vector_search_service = None


def get_vector_search_service() -> VectorSearchService:
    """Get or create the global vector search service instance"""
    global _vector_search_service
    if _vector_search_service is None:
        _vector_search_service = VectorSearchService()
    return _vector_search_service
