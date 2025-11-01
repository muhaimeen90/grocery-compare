#!/usr/bin/env python3
"""
Delete Pinecone Index Script
"""
import os
from dotenv import load_dotenv
from pinecone import Pinecone

load_dotenv()

def delete_index(index_name: str = "grocery-hybrid"):
    """Delete a Pinecone index"""
    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        print("❌ PINECONE_API_KEY not found in environment variables")
        return
    
    print(f"🔌 Connecting to Pinecone...")
    pc = Pinecone(api_key=api_key)
    
    existing_indexes = pc.list_indexes()
    index_names = [idx['name'] for idx in existing_indexes]
    
    if index_name in index_names:
        print(f"🗑️  Deleting index: {index_name}")
        pc.delete_index(index_name)
        print(f"✅ Index '{index_name}' deleted successfully")
    else:
        print(f"ℹ️  Index '{index_name}' does not exist")
    
    print("\n📋 Remaining indexes:")
    remaining = pc.list_indexes()
    if remaining:
        for idx in remaining:
            print(f"  - {idx['name']}")
    else:
        print("  (none)")

if __name__ == "__main__":
    delete_index()
