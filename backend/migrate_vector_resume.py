#!/usr/bin/env python3
"""
SQLite to Pinecone Vector Migration Script with Smart Resume + Multithreading

This script efficiently resumes migration by:
1. Querying Pinecone to get existing product IDs (without fetch limit issues)
2. Only generating embeddings for missing products
3. Uploading only new products (using parallel uploads)

This is more efficient than the original script when resuming after a crash.
"""
import sys
import os
from pathlib import Path
from typing import List, Dict, Any, Set
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import argparse
from math import ceil

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone, ServerlessSpec
from app.database import SessionLocal
from app.models import Product

# Load environment variables
load_dotenv()


def init_pinecone(api_key: str, index_name: str = "grocery-products") -> Pinecone:
    """
    Initialize Pinecone client and create index if it doesn't exist
    """
    print("🔌 Initializing Pinecone...")
    pc = Pinecone(api_key=api_key)
    
    # Check if index exists
    existing_indexes = pc.list_indexes()
    index_names = [idx['name'] for idx in existing_indexes]
    
    if index_name not in index_names:
        print(f"📊 Creating new index: {index_name}")
        pc.create_index(
            name=index_name,
            dimension=384,  # all-MiniLM-L6-v2 produces 384-dimensional embeddings
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        # Wait for index to be ready
        print("⏳ Waiting for index to be ready...")
        time.sleep(10)
    else:
        print(f"✅ Using existing index: {index_name}")
    
    return pc


def load_embedding_model() -> SentenceTransformer:
    """
    Load sentence transformer model for generating embeddings
    """
    print("🤖 Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("✅ Model loaded")
    return model


def get_all_products(db_session) -> List[Product]:
    """
    Fetch all products from SQLite database
    """
    print("📊 Fetching products from SQLite...")
    products = db_session.query(Product).all()
    print(f"✅ Found {len(products):,} products in database")
    return products


def check_small_batch_exists(index, batch_ids: List[str]) -> Set[int]:
    """
    Check if a small batch of product IDs exists in Pinecone
    Returns a set of product IDs (integers, not vector IDs)
    """
    try:
        result = index.fetch(ids=batch_ids)
        existing = set()
        
        if result and 'vectors' in result:
            # Extract the numeric product IDs
            for vector_id in result['vectors'].keys():
                product_id = int(vector_id.replace('product_', ''))
                existing.add(product_id)
        
        return existing
    except Exception as e:
        # If still too large, return empty set
        return set()


def get_existing_product_ids_optimized(pc: Pinecone, index_name: str, all_product_ids: List[int]) -> Set[int]:
    """
    Get IDs of products that already exist in Pinecone using smaller batches with multithreading
    Returns a set of product IDs (integers, not vector IDs)
    """
    print("🔍 Checking for existing products in Pinecone (using optimized small batches)...")
    try:
        index = pc.Index(index_name)
        stats = index.describe_index_stats()
        total_vectors = stats.get('total_vector_count', 0)
        
        if total_vectors == 0:
            print("  ℹ️  No existing products found - starting fresh migration")
            return set()
        
        print(f"  ℹ️  Found {total_vectors:,} existing vectors in Pinecone")
        print(f"  📥 Checking existence for {len(all_product_ids):,} product IDs...")
        
        # Use smaller batch size to avoid 414 error (100 instead of 1000)
        batch_size = 100
        batches = []
        
        for i in range(0, len(all_product_ids), batch_size):
            batch_ids = all_product_ids[i:i + batch_size]
            vector_ids = [f"product_{pid}" for pid in batch_ids]
            batches.append(vector_ids)
        
        total_batches = len(batches)
        print(f"  📦 Created {total_batches:,} batches of {batch_size} IDs each")
        print(f"  🚀 Using parallel processing with 20 threads (faster with smaller batches)...")
        
        existing_product_ids = set()
        start_time = time.time()
        completed = 0
        
        # Use ThreadPoolExecutor for parallel checking with more workers
        with ThreadPoolExecutor(max_workers=20) as executor:
            # Submit all batch checks
            future_to_batch = {
                executor.submit(check_small_batch_exists, index, batch): idx 
                for idx, batch in enumerate(batches)
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_batch):
                batch_existing = future.result()
                existing_product_ids.update(batch_existing)
                completed += 1
                
                # Progress update every 100 batches or at the end
                if completed % 100 == 0 or completed == total_batches:
                    elapsed = time.time() - start_time
                    speed = (completed * batch_size) / elapsed if elapsed > 0 else 0
                    progress = (completed / total_batches) * 100
                    print(f"  ⏳ Progress: {progress:.1f}% ({completed}/{total_batches} batches, {speed:.0f} IDs/sec)")
        
        elapsed = time.time() - start_time
        print(f"  ✅ Found {len(existing_product_ids):,} existing product IDs in {elapsed:.1f}s")
        print(f"  ⚡ Average speed: {len(all_product_ids) / elapsed:.0f} IDs/second")
        
        return existing_product_ids
    
    except Exception as e:
        print(f"  ⚠️  Warning: Could not fetch existing IDs: {e}")
        print("  ℹ️  Will proceed with full migration")
        import traceback
        traceback.print_exc()
        return set()


def filter_new_products(products: List[Product], existing_ids: Set[int]) -> List[Product]:
    """
    Filter out products that already exist in Pinecone
    """
    if not existing_ids:
        print("🔍 No existing products to filter - will migrate all products")
        return products
    
    print(f"🔍 Filtering out existing products...")
    new_products = [p for p in products if p.id not in existing_ids]
    existing_count = len(products) - len(new_products)
    
    print(f"  ✅ {len(new_products):,} new products to migrate")
    print(f"  ⏭️  {existing_count:,} products already in Pinecone (will skip)")
    
    return new_products


def generate_embeddings(model: SentenceTransformer, product_names: List[str]) -> List[List[float]]:
    """
    Generate embeddings for product names
    """
    if not product_names:
        print("ℹ️  No product names to generate embeddings for")
        return []
    
    print(f"🧮 Generating embeddings for {len(product_names):,} products...")
    embeddings = model.encode(product_names, show_progress_bar=True, batch_size=32)
    print("✅ Embeddings generated")
    return embeddings.tolist()


def upload_vectors_worker(index, vectors):
    try:
        index.upsert(vectors=vectors)
        return len(vectors), None
    except Exception as e:
        return 0, str(e)


def process_all_restart(pc: Pinecone, index_name: str, products: List[Product],
                        model: SentenceTransformer,
                        encode_batch_size: int = 64,
                        encode_chunk_size: int = 2000,
                        upload_batch_size: int = 100,
                        upload_workers: int = 10):
    """
    Re-encode and upsert all products in chunks.
    This skips existence checks (use --force-restart). Safe because upsert overwrites existing vectors.
    """
    index = pc.Index(index_name)
    total = len(products)
    print(f"🔁 Force restart: re-encoding & upserting all {total:,} products")
    start_total = time.time()

    for start in range(0, total, encode_chunk_size):
        chunk = products[start:start + encode_chunk_size]
        names = [p.name for p in chunk]
        # encode chunk
        embeddings = model.encode(names, show_progress_bar=False, batch_size=encode_batch_size)
        # ensure list form
        try:
            embeddings = embeddings.tolist()
        except Exception:
            embeddings = list(embeddings)

        # prepare vectors
        vectors = []
        for product, emb in zip(chunk, embeddings):
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
            vectors.append((f"product_{product.id}", emb, metadata))

        # upload in parallel batches
        batches = [vectors[i:i + upload_batch_size] for i in range(0, len(vectors), upload_batch_size)]
        uploaded = 0
        with ThreadPoolExecutor(max_workers=upload_workers) as executor:
            futures = [executor.submit(upload_vectors_worker, index, b) for b in batches]
            for f in as_completed(futures):
                count, err = f.result()
                uploaded += count
                if err:
                    print(f"  ⚠️ Upload error: {err}")

        done = min(start + encode_chunk_size, total)
        elapsed = time.time() - start_total
        print(f"  ✅ Chunk {start}-{done} done, uploaded {uploaded:,} vectors (elapsed {elapsed:.1f}s)")

    total_elapsed = time.time() - start_total
    print(f"\n✅ Force-restart complete: processed {total:,} products in {total_elapsed:.1f}s")


def upload_batch(index, vectors: List, batch_num: int):
    """
    Upload a batch of vectors to Pinecone (for multithreading)
    """
    try:
        index.upsert(vectors=vectors)
        return len(vectors), None
    except Exception as e:
        return 0, f"Batch {batch_num}: {e}"


def upload_to_pinecone(
    pc: Pinecone,
    index_name: str,
    products: List[Product],
    embeddings: List[List[float]],
    batch_size: int = 100
):
    """
    Upload product embeddings to Pinecone in batches using multithreading
    """
    if not products:
        print("ℹ️  No products to upload")
        return
    
    index = pc.Index(index_name)
    
    print(f"📤 Preparing {len(products):,} vectors for upload...")
    
    # Prepare all vectors first
    all_vectors = []
    
    for product, embedding in zip(products, embeddings):
        # Prepare metadata
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
        
        # Create vector tuple: (id, embedding, metadata)
        all_vectors.append((
            f"product_{product.id}",
            embedding,
            metadata
        ))
    
    print(f"  ✅ Prepared {len(all_vectors):,} vectors")
    print(f"  🚀 Uploading in parallel batches of {batch_size}...")
    
    # Split into batches
    batches = [all_vectors[i:i + batch_size] for i in range(0, len(all_vectors), batch_size)]
    total_batches = len(batches)
    
    uploaded = 0
    start_time = time.time()
    
    # Upload batches in parallel
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_batch = {
            executor.submit(upload_batch, index, batch, idx + 1): idx 
            for idx, batch in enumerate(batches)
        }
        
        for future in as_completed(future_to_batch):
            count, error = future.result()
            uploaded += count
            
            if error:
                print(f"  ⚠️  {error}")
            else:
                batch_num = future_to_batch[future] + 1
                if batch_num % 10 == 0 or batch_num == total_batches:
                    elapsed = time.time() - start_time
                    speed = uploaded / elapsed if elapsed > 0 else 0
                    print(f"  ✅ Batch {batch_num}/{total_batches} - Uploaded {uploaded:,}/{len(all_vectors):,} ({speed:.0f} vectors/sec)")
    
    elapsed = time.time() - start_time
    print(f"✅ Upload complete: {uploaded:,} new products uploaded in {elapsed:.1f}s")


def get_index_stats(pc: Pinecone, index_name: str):
    """
    Get and display index statistics
    """
    index = pc.Index(index_name)
    stats = index.describe_index_stats()
    print("\n" + "=" * 80)
    print("📊 Pinecone Index Statistics")
    print("=" * 80)
    print(f"  Total vectors: {stats.get('total_vector_count', 0):,}")
    print(f"  Dimension: {stats.get('dimension', 0)}")
    print("=" * 80)


def main():
    """
    Main migration function with smart resume and multithreading
    """
    parser = argparse.ArgumentParser(description="Migrate product vectors to Pinecone")
    parser.add_argument("--force-restart", action="store_true",
                        help="Skip existence checks and re-encode+upsert all products (faster).")
    parser.add_argument("--encode-batch-size", type=int, default=64,
                        help="Batch size for the encoder")
    parser.add_argument("--encode-chunk-size", type=int, default=2000,
                        help="How many products to encode in one chunk before parallel uploading")
    parser.add_argument("--upload-batch-size", type=int, default=100,
                        help="Number of vectors per upsert call")
    parser.add_argument("--upload-workers", type=int, default=10,
                        help="Parallel workers for uploading")
    args = parser.parse_args()

    print("=" * 80)
    print("🚀 SQLite to Pinecone Vector Migration (Smart Resume + Multithreading)")
    print("=" * 80)

    # Get API key from environment
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        print("❌ PINECONE_API_KEY not found in environment variables")
        print("Please set it in .env file or export it")
        return

    index_name = "grocery-products"

    try:
        # Initialize components
        pc = init_pinecone(api_key, index_name)

        # Get products from database FIRST
        db = SessionLocal()
        try:
            all_products = get_all_products(db)

            if not all_products:
                print("❌ No products found in database")
                return

            # Force-restart path: re-encode & upsert everything (faster than expensive existence checking)
            if args.force_restart:
                model = load_embedding_model()
                process_all_restart(pc, index_name, all_products, model,
                                    encode_batch_size=args.encode_batch_size,
                                    encode_chunk_size=args.encode_chunk_size,
                                    upload_batch_size=args.upload_batch_size,
                                    upload_workers=args.upload_workers)
                get_index_stats(pc, index_name)
                return

            # Default: previous optimized resume that checks existing ids
            all_product_ids = [p.id for p in all_products]
            print(f"ℹ️  Product ID range: {min(all_product_ids)} to {max(all_product_ids)}")

            existing_ids = get_existing_product_ids_optimized(pc, index_name, all_product_ids)

            # Filter to only new products
            new_products = filter_new_products(all_products, existing_ids)

            if not new_products:
                print("\n✅ All products are already in Pinecone!")
                get_index_stats(pc, index_name)
                return

            # Load model only if we have work to do
            model = load_embedding_model()

            # Generate embeddings only for new products
            product_names = [product.name for product in new_products]
            embeddings = generate_embeddings(model, product_names)

            # Upload to Pinecone (PARALLEL)
            upload_to_pinecone(pc, index_name, new_products, embeddings)

            # Show statistics
            get_index_stats(pc, index_name)

            print("\n🎉 Migration completed successfully!")
            print(f"📍 Index name: {index_name}")
            print(f"📊 Total products in database: {len(all_products):,}")
            print(f"✅ New products migrated: {len(new_products):,}")
            print(f"⏭️  Products already existed: {len(existing_ids):,}")

        finally:
            db.close()

    except KeyboardInterrupt:
        print("\n\n⚠️  Migration interrupted by user")
        print("💡 You can resume by running the script again - it will skip existing products")
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
