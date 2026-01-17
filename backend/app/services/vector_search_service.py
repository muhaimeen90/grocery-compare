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
            import nltk
            from dotenv import load_dotenv
            from pinecone import Pinecone
            from sentence_transformers import SentenceTransformer
            from pinecone_text.sparse import BM25Encoder
            from pathlib import Path
            
            # Download required NLTK data
            try:
                nltk.download('punkt', quiet=True)
                nltk.download('punkt_tab', quiet=True)
                nltk.download('stopwords', quiet=True)
            except Exception as e:
                print(f"⚠️  Failed to download NLTK data: {e}")
            
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
        
        Returns alternatives per store with approval status:
        - Primary match: exact or very similar product (auto-approved if score is high)
        - Fallback alternatives: same brand/diff size OR same size/diff brand (needs approval)
        
        The user can approve one alternative per store, not both.
        """
        if not self.index:
            print("⚠️  Vector index not initialized for identical product search")
            return []
        
        STORES = ["IGA", "Woolworths", "Coles"]
        
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
            # Fetch more candidates (top_k=50) to have enough for re-ranking and fallbacks
            results = self.index.query(
                vector=dense_vector,
                sparse_vector=sparse_vector,
                top_k=50,
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
        
        # Preserve full candidate pool for fallback selection
        # Store candidates by store for easy lookup
        candidates_by_store = {}
        for candidate in candidates:
            store = candidate.get('store')
            if store:
                if store not in candidates_by_store:
                    candidates_by_store[store] = []
                candidates_by_store[store].append(candidate)
        
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
        
        # --- Replace non-auto-approved matches with two fallback alternatives per store ---
        # Normalize original product fields for comparison
        orig_size_clean = (original_product.size or "").strip().lower()
        orig_brand_clean = (original_product.brand or "").strip().lower()
        
        # Separate auto-approved matches from non-auto-approved ones
        auto_approved_matches = []
        non_auto_approved_stores = set()
        
        for match in ranked_matches:
            store = match.get('store')
            if not match.get('needs_approval'):
                # Keep auto-approved matches as-is
                auto_approved_matches.append(match)
            else:
                # Track stores with non-auto-approved matches - we'll replace these with fallbacks
                non_auto_approved_stores.add(store)
        
        # Start with only auto-approved matches
        final_results = auto_approved_matches.copy()
        
        # Also check for completely missing stores
        found_stores = {m['store'] for m in ranked_matches}
        missing_stores = [s for s in STORES if s != original_product.store and s not in found_stores]
        
        # Process stores that need fallback alternatives (non-auto-approved + missing)
        stores_needing_fallbacks = list(non_auto_approved_stores | set(missing_stores))
        
        # Track product IDs already added to avoid duplicates
        existing_product_ids = {m.get('product_id') for m in final_results if m.get('product_id')}
        
        # --- Add fallback alternatives from candidate pool for non-auto-approved stores ---
        # For each store, return TWO products: (1) same size/diff brand, (2) same brand/diff size
        for store in stores_needing_fallbacks:
            store_candidates = candidates_by_store.get(store, [])
            if not store_candidates:
                print(f"  ⚠️  No candidates found for {store} in initial pool")
                continue
            
            # Strategy 1: Same Size / Different Brand (highest vector score from candidates)
            if orig_size_clean:
                size_matches = [
                    c for c in store_candidates
                    if (c.get('size') or "").strip().lower() == orig_size_clean and
                       (c.get('brand') or "").strip().lower() != orig_brand_clean and
                       c.get('product_id') not in existing_product_ids
                ]
                
                if size_matches:
                    # Sort by vector similarity score (highest first)
                    size_matches.sort(key=lambda x: x.get('similarity_score', 0), reverse=True)
                    best_size_match = size_matches[0]
                    
                    print(f"  🔄 Fallback 1 (Same Size/Diff Brand) for {store}: {best_size_match.get('name', '')[:50]} (vector: {best_size_match.get('similarity_score', 0):.3f})")
                    
                    final_results.append({
                        **best_size_match,
                        "brand_matched": False,
                        "size_matched": True,
                        "needs_approval": True,
                        "identical_score": best_size_match.get('similarity_score', 0),  # Use raw vector score
                        "is_fallback": True,
                        "fallback_type": "same_size_diff_brand"
                    })
                    existing_product_ids.add(best_size_match.get('product_id'))
            
            # Strategy 2: Same Brand / Different Size (highest vector score from candidates)
            if orig_brand_clean:
                brand_matches = [
                    c for c in store_candidates
                    if (c.get('brand') or "").strip().lower() == orig_brand_clean and
                       (c.get('size') or "").strip().lower() != orig_size_clean and
                       c.get('product_id') not in existing_product_ids
                ]
                
                if brand_matches:
                    # Sort by vector similarity score (highest first)
                    brand_matches.sort(key=lambda x: x.get('similarity_score', 0), reverse=True)
                    best_brand_match = brand_matches[0]
                    
                    print(f"  🔄 Fallback 2 (Same Brand/Diff Size) for {store}: {best_brand_match.get('name', '')[:50]} (vector: {best_brand_match.get('similarity_score', 0):.3f})")
                    
                    final_results.append({
                        **best_brand_match,
                        "brand_matched": True,
                        "size_matched": False,
                        "needs_approval": True,
                        "identical_score": best_brand_match.get('similarity_score', 0),  # Use raw vector score
                        "is_fallback": True,
                        "fallback_type": "same_brand_diff_size"
                    })
                    existing_product_ids.add(best_brand_match.get('product_id'))
            
            # Log if no alternatives found for this store
            if store not in [r.get('store') for r in final_results if r.get('is_fallback')]:
                print(f"  ℹ️  No fallback alternatives found for {store} (no same-size/diff-brand or same-brand/diff-size in candidates)")
        
        # Sort final list by score (descending)
        final_results.sort(key=lambda x: x.get('identical_score', 0), reverse=True)
        
        for match in final_results:
            status = "✅ AUTO" if not match.get('needs_approval') else "⚠️ NEEDS APPROVAL"
            fallback_info = f" [{match.get('fallback_type', 'primary')}]" if match.get('is_fallback') else ""
            print(f"  {status}: {match.get('name', 'N/A')[:50]} from {match.get('store')} "
                  f"(score: {match.get('identical_score', 0):.3f}, "
                  f"size_match: {match.get('size_matched')}, brand_match: {match.get('brand_matched')}){fallback_info}")
        
        print(f"  📊 Total matches after re-ranking and fallbacks: {len(final_results)}\n")
        return final_results


# Global instance
_vector_search_service = None


def get_vector_search_service() -> VectorSearchService:
    """Get or create the global vector search service instance"""
    global _vector_search_service
    if _vector_search_service is None:
        _vector_search_service = VectorSearchService()
    return _vector_search_service
