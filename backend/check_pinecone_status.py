#!/usr/bin/env python3
"""
Quick script to check Pinecone migration status
"""
import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

def main():
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        print("❌ PINECONE_API_KEY not found")
        return
    
    print("=" * 80)
    print("📊 Pinecone Migration Status Check")
    print("=" * 80)
    
    pc = Pinecone(api_key=api_key)
    index_name = "grocery-products"
    
    try:
        index = pc.Index(index_name)
        stats = index.describe_index_stats()
        
        total_vectors = stats.get('total_vector_count', 0)
        dimension = stats.get('dimension', 0)
        
        print(f"\n✅ Index '{index_name}' exists")
        print(f"   • Total vectors: {total_vectors:,}")
        print(f"   • Dimension: {dimension}")
        print(f"   • Namespace info: {stats.get('namespaces', {})}")
        
        if total_vectors > 0:
            print(f"\n🎯 Migration Progress: {total_vectors:,} products uploaded")
            print("   You can safely resume the migration if it was interrupted.")
        else:
            print("\n⚠️  No products uploaded yet. Starting fresh migration.")
        
        print("\n" + "=" * 80)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("   Index may not exist or there's a connection issue.")

if __name__ == "__main__":
    main()
