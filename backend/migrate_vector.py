#!/usr/bin/env python3
"""
SQLite to Pinecone Vector Migration Script

This script reads products from the SQLite database, generates embeddings
for product names using sentence-transformers, and uploads them to Pinecone.
"""
import sys
import os
from pathlib import Path
from typing import List, Dict, Any, Set
import time

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
    print(f"✅ Found {len(products):,} products")
    return products


def get_existing_product_ids(pc: Pinecone, index_name: str, all_product_ids: List[int]) -> Set[str]:
    """
    Get IDs of products that already exist in Pinecone
    Uses the actual product IDs from database to check existence
    """
    print("🔍 Checking for existing products in Pinecone...")
    try:
        index = pc.Index(index_name)
        stats = index.describe_index_stats()
        total_vectors = stats.get('total_vector_count', 0)
        
        if total_vectors == 0:
            print("  ℹ️  No existing products found - starting fresh migration")
            return set()
        
        print(f"  ℹ️  Found {total_vectors:,} existing vectors in Pinecone")
        print(f"  📥 Checking existence for {len(all_product_ids):,} product IDs...")
        
        existing_ids = set()
        batch_size = 1000
        
        # Check in batches using actual product IDs from database
        for i in range(0, len(all_product_ids), batch_size):
            batch_ids = all_product_ids[i:i + batch_size]
            vector_ids = [f"product_{pid}" for pid in batch_ids]
            
            try:
                result = index.fetch(ids=vector_ids)
                if result and 'vectors' in result:
                    existing_ids.update(result['vectors'].keys())
                    
                # Progress indicator
                if (i + batch_size) % 10000 == 0:
                    print(f"  ⏳ Checked {i + batch_size:,}/{len(all_product_ids):,} products...")
                    
            except Exception as e:
                print(f"  ⚠️  Warning: Error checking batch {i}-{i+batch_size}: {e}")
                continue
        
        print(f"  ✅ Found {len(existing_ids):,} existing product IDs in Pinecone")
        return existing_ids
    
    except Exception as e:
        print(f"  ⚠️  Warning: Could not fetch existing IDs: {e}")
        print("  ℹ️  Will proceed without resume capability")
        return set()


def generate_embeddings(model: SentenceTransformer, product_names: List[str]) -> List[List[float]]:
    """
    Generate embeddings for product names
    """
    print(f"🧮 Generating embeddings for {len(product_names):,} products...")
    embeddings = model.encode(product_names, show_progress_bar=True, batch_size=32)
    print("✅ Embeddings generated")
    return embeddings.tolist()


def upload_to_pinecone(
    pc: Pinecone,
    index_name: str,
    products: List[Product],
    embeddings: List[List[float]],
    existing_ids: set = None,
    batch_size: int = 100
):
    """
    Upload product embeddings to Pinecone in batches
    Skips products that already exist in Pinecone
    """
    index = pc.Index(index_name)
    
    if existing_ids is None:
        existing_ids = set()
    
    print(f"📤 Uploading vectors to Pinecone...")
    
    vectors = []
    skipped = 0
    uploaded = 0
    
    for i, (product, embedding) in enumerate(zip(products, embeddings)):
        product_vector_id = f"product_{product.id}"
        
        # Skip if already exists
        if product_vector_id in existing_ids:
            skipped += 1
            if skipped % 1000 == 0:
                print(f"  ⏭️  Skipped {skipped:,} existing products...")
            continue
        
        # Prepare metadata (excluding embedding)
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
        vectors.append((
            product_vector_id,
            embedding,
            metadata
        ))
        
        # Upload in batches
        if len(vectors) >= batch_size or i == len(products) - 1:
            index.upsert(vectors=vectors)
            uploaded += len(vectors)
            print(f"  ✅ Uploaded batch: {uploaded:,} new products (skipped {skipped:,} existing)")
            vectors = []
    
    print(f"✅ Upload complete: {uploaded:,} new products uploaded, {skipped:,} skipped")


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
    Main migration function
    """
    print("=" * 80)
    print("🚀 SQLite to Pinecone Vector Migration (Smart Resume)")
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
        
        # Get products from database FIRST (before loading model)
        db = SessionLocal()
        try:
            products = get_all_products(db)
            
            if not products:
                print("❌ No products found in database")
                return
            
            # Get all product IDs from database
            all_product_ids = [p.id for p in products]
            print(f"ℹ️  Product ID range: {min(all_product_ids)} to {max(all_product_ids)}")
            
            # Check for existing products in Pinecone using actual product IDs
            existing_ids = get_existing_product_ids(pc, index_name, all_product_ids)
            
            # Filter out products that already exist
            print("🔍 Filtering out existing products...")
            products_to_migrate = [
                p for p in products 
                if f"product_{p.id}" not in existing_ids
            ]
            
            print(f"  ✅ {len(products_to_migrate):,} new products to migrate")
            print(f"  ⏭️  {len(existing_ids):,} products already in Pinecone (will skip)")
            
            if not products_to_migrate:
                print("\n✅ All products already migrated!")
                get_index_stats(pc, index_name)
                return
            
            # Now load the model (only if we have work to do)
            model = load_embedding_model()
            
            # Extract product names for products that need migration
            product_names = [product.name for product in products_to_migrate]
            
            # Generate embeddings only for new products
            embeddings = generate_embeddings(model, product_names)
            
            # Upload to Pinecone
            upload_to_pinecone(
                pc, 
                index_name, 
                products_to_migrate, 
                embeddings, 
                existing_ids=set()  # Already filtered, so pass empty set
            )
            
            # Show statistics
            get_index_stats(pc, index_name)
            
            print("\n🎉 Migration completed successfully!")
            print(f"📍 Index name: {index_name}")
            print(f"📊 Total products in database: {len(products):,}")
            print(f"✅ Products migrated this run: {len(products_to_migrate):,}")
            print(f"⏭️  Products skipped (existing): {len(existing_ids):,}")
            
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
