#!/usr/bin/env python3
"""
Fast SQLite to Pinecone Vector Migration Script

This script uses upsert to handle duplicates automatically.
No existence checking - just encode and upload everything in parallel.
Upsert overwrites existing vectors, so 100% safe with no duplicates.
"""
import sys
import os
from pathlib import Path
from typing import List
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec
from pinecone_text.sparse import BM25Encoder
from app.database import SessionLocal
from app.models import Product

# Load environment variables
load_dotenv()


def init_pinecone(api_key: str, index_name: str = "grocery-hybrid") -> Pinecone:
    """Initialize Pinecone client for hybrid search (dense + sparse vectors)"""
    print("🔌 Initializing Pinecone...")
    pc = Pinecone(api_key=api_key)
    
    existing_indexes = pc.list_indexes()
    index_names = [idx['name'] for idx in existing_indexes]
    
    if index_name not in index_names:
        print(f"📊 Creating new HYBRID index: {index_name}")
        print("   - Dense vectors: 384 dimensions (all-MiniLM-L6-v2)")
        print("   - Sparse vectors: BM25 (keyword matching)")
        print("   - Metric: dotproduct (required for hybrid)")
        pc.create_index(
            name=index_name,
            dimension=384,
            metric="dotproduct",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )
        print("⏳ Waiting for index to be ready...")
        time.sleep(15)  # Give it a bit more time for hybrid setup
    else:
        print(f"✅ Using existing index: {index_name}")
        # Verify it's configured for hybrid search
        index_info = pc.describe_index(index_name)
        print(f"   Metric: {index_info.get('metric', 'unknown')}")
    
    return pc


def get_all_products(db_session) -> List[Product]:
    """Fetch all products from SQLite database"""
    print("📊 Fetching products from SQLite...")
    products = db_session.query(Product).all()
    print(f"✅ Found {len(products):,} products in database")
    return products


def upload_batch_worker(index, batch):
    """Upload a batch of vectors (for parallel processing)"""
    try:
        index.upsert(vectors=batch)
        return len(batch), None
    except Exception as e:
        return 0, str(e)


def process_chunk(products_chunk: List[Product], model: SentenceTransformer, 
                  bm25_encoder: BM25Encoder, index, chunk_num: int, 
                  upload_batch_size: int = 100, upload_workers: int = 10):
    """
    Process a chunk of products: encode and upload in parallel
    """
    # Extract product names
    product_names = [p.name for p in products_chunk]
    
    # Generate embeddings for this chunk
    embeddings = model.encode(product_names, show_progress_bar=False, batch_size=64)
    
    # Prepare vectors
    vectors = []
    for product, embedding in zip(products_chunk, embeddings):
        metadata = {
            "product_id": product.id,
            "name": product.name,
            "price": product.price,
            "price_numeric": float(product.price_numeric) if product.price_numeric else 0.0,
            "brand": product.brand or "",
            "category": product.category,
            "store": product.store,
            "product_url": product.product_url or "",
            "image_url": product.image_url or "",
        }
        
        # Generate sparse vector
        sparse_vector = bm25_encoder.encode_documents(product.name)
        
        vectors.append({
            "id": f"product_{product.id}",
            "values": embedding.tolist() if hasattr(embedding, 'tolist') else list(embedding),
            "sparse_values": {
                "indices": sparse_vector['indices'],
                "values": sparse_vector['values']
            },
            "metadata": metadata
        })
    
    # Split into upload batches and upload in parallel
    upload_batches = [vectors[i:i + upload_batch_size] 
                     for i in range(0, len(vectors), upload_batch_size)]
    
    uploaded = 0
    with ThreadPoolExecutor(max_workers=upload_workers) as executor:
        futures = [executor.submit(upload_batch_worker, index, batch) 
                  for batch in upload_batches]
        
        for future in as_completed(futures):
            count, error = future.result()
            uploaded += count
            if error:
                print(f"  ⚠️  Upload error in chunk {chunk_num}: {error}")
    
    return uploaded


def main():
    """Main migration function"""
    print("=" * 80)
    print("🚀 Fast SQLite to Pinecone Migration (No Duplicate Checking)")
    print("   Using upsert - automatically overwrites existing vectors")
    print("=" * 80)
    
    # Configuration
    ENCODE_CHUNK_SIZE = 5000      # Process 5000 products at a time
    UPLOAD_BATCH_SIZE = 100       # Upload 100 vectors per API call
    UPLOAD_WORKERS = 10           # 10 parallel upload threads per chunk
    NUM_CHUNK_WORKERS = 2         # Process 2 encoding chunks in parallel
    
    # Get API key
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        print("❌ PINECONE_API_KEY not found in environment variables")
        return
    
    index_name = "grocery-hybrid"
    
    try:
        # Initialize Pinecone
        pc = init_pinecone(api_key, index_name)
        index = pc.Index(index_name)
        
        # Load embedding model
        print("🤖 Loading embedding model (all-MiniLM-L6-v2)...")
        model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Model loaded")
        
        # Get all products
        db = SessionLocal()
        try:
            all_products = get_all_products(db)
            
            if not all_products:
                print("❌ No products found in database")
                return
            
            # Initialize and fit BM25 encoder
            print("🔤 Fitting BM25 encoder for sparse vectors...")
            bm25_encoder = BM25Encoder.default()
            all_product_names = [p.name for p in all_products]
            bm25_encoder.fit(all_product_names)
            bm25_encoder.dump("bm25_params.json")
            print("✅ BM25 encoder fitted and saved")
            
            total_products = len(all_products)
            print(f"\n📦 Processing {total_products:,} products in chunks of {ENCODE_CHUNK_SIZE:,}")
            print(f"🚀 Using {NUM_CHUNK_WORKERS} parallel encoding workers")
            print(f"⚡ Each chunk uploads with {UPLOAD_WORKERS} parallel threads\n")
            
            # Split products into chunks
            chunks = [all_products[i:i + ENCODE_CHUNK_SIZE] 
                     for i in range(0, total_products, ENCODE_CHUNK_SIZE)]
            
            total_uploaded = 0
            start_time = time.time()
            
            # Process chunks in parallel (limited parallelism for encoding)
            with ThreadPoolExecutor(max_workers=NUM_CHUNK_WORKERS) as executor:
                futures = {
                    executor.submit(
                        process_chunk, 
                        chunk, 
                        model,
                        bm25_encoder,
                        index, 
                        idx + 1,
                        UPLOAD_BATCH_SIZE,
                        UPLOAD_WORKERS
                    ): (idx + 1, len(chunk))
                    for idx, chunk in enumerate(chunks)
                }
                
                for future in as_completed(futures):
                    chunk_num, chunk_size = futures[future]
                    uploaded = future.result()
                    total_uploaded += uploaded
                    
                    elapsed = time.time() - start_time
                    speed = total_uploaded / elapsed if elapsed > 0 else 0
                    progress = (total_uploaded / total_products) * 100
                    
                    print(f"✅ Chunk {chunk_num}/{len(chunks)} complete: "
                          f"{total_uploaded:,}/{total_products:,} products "
                          f"({progress:.1f}%) - {speed:.0f} products/sec")
            
            # Final stats
            total_time = time.time() - start_time
            final_speed = total_products / total_time
            
            print("\n" + "=" * 80)
            print("🎉 Migration Complete!")
            print("=" * 80)
            print(f"  Total products: {total_products:,}")
            print(f"  Total time: {total_time:.1f}s")
            print(f"  Average speed: {final_speed:.0f} products/sec")
            
            # Get final index stats
            stats = index.describe_index_stats()
            print(f"\n📊 Pinecone Index Stats:")
            print(f"  Total vectors: {stats.get('total_vector_count', 0):,}")
            print("=" * 80)
            
        finally:
            db.close()
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration interrupted by user")
        print("💡 Run the script again to continue - upsert handles duplicates automatically")
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
