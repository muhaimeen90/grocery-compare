#!/usr/bin/env python3
"""
Update Size and Brand Fields from CSVs

This script updates existing products with size and brand data from CSV files.
It also inserts new products that don't exist in the database.
Uses product_url as the unique identifier for matching.
"""
import sys
import os
from pathlib import Path
from typing import Dict, Tuple
import time

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
from sqlalchemy import text
from app.database import SessionLocal, engine
from app.models import Product
from app.utils.price_parser import extract_numeric_price


def normalize_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize CSV column names to match database schema
    """
    column_map = {
        'title': 'name',
        'productUrl': 'product_url',
        'producturl': 'product_url',
        'imageUrl': 'image_url',
        'imageurl': 'image_url',
        'product_url': 'product_url',
        'image_url': 'image_url',
        'productURL': 'product_url',
        'imageURL': 'image_url',
        'ProductURL': 'product_url',
        'ImageURL': 'image_url',
        'Size': 'size',
        'SIZE': 'size',
        'Brand': 'brand',
        'BRAND': 'brand',
    }
    
    df.rename(columns=column_map, inplace=True)
    return df


def clean_category_name(category: str) -> str:
    """
    Clean category name from filename
    """
    import re
    # Remove store prefix
    category = re.sub(r'^(iga_|woolworths_|coles_)', '', category, flags=re.IGNORECASE)
    
    # Replace underscores with spaces
    category = category.replace('_', ' ')
    
    # Title case
    category = category.title()
    
    return category


def add_size_column_if_missing():
    """
    Add the size column to products table if it doesn't exist
    """
    print("🔍 Checking if 'size' column exists...")
    
    with engine.connect() as conn:
        # Check if column exists (SQLite specific)
        result = conn.execute(text("PRAGMA table_info(products)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'size' not in columns:
            print("➕ Adding 'size' column to products table...")
            conn.execute(text("ALTER TABLE products ADD COLUMN size TEXT"))
            conn.commit()
            print("✅ 'size' column added successfully")
        else:
            print("✅ 'size' column already exists")


def process_csv_file(csv_path: Path, store_name: str, category_name: str, 
                     db, url_to_product: Dict[str, Product]) -> Tuple[int, int]:
    """
    Process a single CSV file and update/insert products
    
    Returns:
        Tuple of (updated_count, inserted_count)
    """
    try:
        df = pd.read_csv(csv_path)
        
        # Normalize column names
        df = normalize_column_names(df)
        
        # Required columns
        required_cols = ['name', 'price']
        if not all(col in df.columns for col in required_cols):
            print(f"  ⚠️  Skipping {csv_path.name}: Missing required columns")
            return 0, 0
        
        # Filter out rows with missing prices
        df = df[df['price'].notna()]
        
        # Ensure product_url column exists
        if 'product_url' not in df.columns:
            print(f"  ⚠️  Skipping {csv_path.name}: Missing product_url column")
            return 0, 0
        
        updated = 0
        inserted = 0
        
        for _, row in df.iterrows():
            product_url = row.get('product_url')
            if pd.isna(product_url) or not product_url:
                continue
            
            # Get size and brand from CSV
            csv_size = row.get('size') if 'size' in df.columns and pd.notna(row.get('size')) else None
            csv_brand = row.get('brand') if 'brand' in df.columns and pd.notna(row.get('brand')) else None
            
            # Check if product exists
            if product_url in url_to_product:
                product = url_to_product[product_url]
                changed = False
                
                # Update size if provided
                if csv_size and product.size != csv_size:
                    product.size = csv_size
                    changed = True
                
                # Update brand if provided
                if csv_brand and product.brand != csv_brand:
                    product.brand = csv_brand
                    changed = True
                
                if changed:
                    updated += 1
            else:
                # Insert new product
                price_numeric = extract_numeric_price(str(row['price']))
                new_product = Product(
                    name=row['name'],
                    price=str(row['price']),
                    price_numeric=price_numeric,
                    brand=csv_brand,
                    size=csv_size,
                    category=category_name,
                    store=store_name,
                    product_url=product_url,
                    image_url=row.get('image_url') if pd.notna(row.get('image_url')) else None,
                )
                db.add(new_product)
                inserted += 1
        
        return updated, inserted
    
    except Exception as e:
        print(f"  ❌ Error processing {csv_path.name}: {e}")
        return 0, 0


def process_store_csvs(store_folder: Path, store_name: str, 
                       db, url_to_product: Dict[str, Product]) -> Tuple[int, int]:
    """
    Process all CSV files from a store folder
    
    Returns:
        Tuple of (total_updated, total_inserted)
    """
    total_updated = 0
    total_inserted = 0
    
    # Process root level CSVs
    for csv_file in sorted(store_folder.glob("*.csv")):
        category = clean_category_name(csv_file.stem)
        updated, inserted = process_csv_file(csv_file, store_name, category, db, url_to_product)
        total_updated += updated
        total_inserted += inserted
        
        if updated > 0 or inserted > 0:
            print(f"    📄 {csv_file.name}: {updated} updated, {inserted} inserted")
    
    # Process from subfolders
    for subfolder in sorted(store_folder.iterdir()):
        if subfolder.is_dir():
            subfolder_category = clean_category_name(subfolder.name)
            
            for csv_file in sorted(subfolder.glob("*.csv")):
                file_category = clean_category_name(csv_file.stem)
                category = f"{subfolder_category} - {file_category}"
                
                updated, inserted = process_csv_file(csv_file, store_name, category, db, url_to_product)
                total_updated += updated
                total_inserted += inserted
                
                if updated > 0 or inserted > 0:
                    print(f"    📄 {subfolder.name}/{csv_file.name}: {updated} updated, {inserted} inserted")
    
    return total_updated, total_inserted


def main():
    """Main update function"""
    print("=" * 80)
    print("🔄 Update Size and Brand Fields from CSVs")
    print("=" * 80)
    
    start_time = time.time()
    
    # Add size column if it doesn't exist
    add_size_column_if_missing()
    
    # CSV data folder
    csv_base_path = Path(__file__).parent / "data"
    
    if not csv_base_path.exists():
        print(f"❌ Data folder not found: {csv_base_path}")
        return
    
    stores_config = {
        'IGA': 'IGA',
        'Woolworths': 'Woolworths',
        'Coles': 'Coles'
    }
    
    db = SessionLocal()
    
    try:
        # Build URL to product mapping for fast lookups
        print("\n📊 Loading existing products from database...")
        all_products = db.query(Product).filter(Product.product_url.isnot(None)).all()
        url_to_product = {p.product_url: p for p in all_products if p.product_url}
        print(f"✅ Loaded {len(url_to_product):,} products with URLs")
        
        total_updated = 0
        total_inserted = 0
        
        for folder_name, store_name in stores_config.items():
            store_path = csv_base_path / folder_name
            
            if not store_path.exists():
                print(f"\n⚠️  {folder_name} folder not found, skipping...")
                continue
            
            print(f"\n📁 Processing {store_name}...")
            updated, inserted = process_store_csvs(store_path, store_name, db, url_to_product)
            total_updated += updated
            total_inserted += inserted
            print(f"  ✅ {store_name}: {updated} updated, {inserted} inserted")
            
            # Commit after each store (batch commit)
            db.commit()
            print(f"  💾 Changes committed")
        
        # Final stats
        elapsed = time.time() - start_time
        
        print("\n" + "=" * 80)
        print("🎉 Update Complete!")
        print("=" * 80)
        print(f"  Total updated: {total_updated:,}")
        print(f"  Total inserted: {total_inserted:,}")
        print(f"  Time elapsed: {elapsed:.1f}s")
        print("\n💡 Next step: Run 'python migrate_vector_fast.py' to update Pinecone vectors")
        print("=" * 80)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    
    finally:
        db.close()


if __name__ == "__main__":
    main()
