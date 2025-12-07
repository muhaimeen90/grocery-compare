"""
CSV to SQLite Migration Utility
"""
import pandas as pd
from pathlib import Path
from sqlalchemy.orm import Session
from typing import Dict
import re

from ..models import Product
from ..database import SessionLocal
from .price_parser import extract_numeric_price


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
    # Remove store prefix
    category = re.sub(r'^(iga_|woolworths_|coles_)', '', category, flags=re.IGNORECASE)
    
    # Replace underscores with spaces
    category = category.replace('_', ' ')
    
    # Title case
    category = category.title()
    
    return category


def import_csv_file(
    csv_path: Path,
    store_name: str,
    category_name: str,
    db: Session
) -> int:
    """
    Import a single CSV file into database
    
    Returns:
        Number of products imported
    """
    try:
        df = pd.read_csv(csv_path)
        
        # Normalize column names
        df = normalize_column_names(df)
        
        # Required columns
        required_cols = ['name', 'price']
        if not all(col in df.columns for col in required_cols):
            print(f"⚠️  Skipping {csv_path.name}: Missing required columns")
            return 0
        
        # Add store and category
        df['store'] = store_name
        df['category'] = category_name
        
        # Filter out rows with missing prices (NaN values)
        initial_count = len(df)
        df = df[df['price'].notna()]
        skipped = initial_count - len(df)
        
        if skipped > 0:
            print(f"  ⚠️  Skipped {skipped} products with missing prices")
        
        # Calculate numeric price
        df['price_numeric'] = df['price'].apply(extract_numeric_price)
        
        # Fill missing values
        df['brand'] = df.get('brand', '')
        df['size'] = df.get('size', '')
        df['product_url'] = df.get('product_url', '')
        df['image_url'] = df.get('image_url', '')
        
        # Import to database
        count = 0
        for _, row in df.iterrows():
            product = Product(
                name=row['name'],
                price=str(row['price']),  # Ensure price is string
                price_numeric=row['price_numeric'],
                brand=row['brand'] if pd.notna(row['brand']) else None,
                size=row['size'] if pd.notna(row['size']) else None,
                category=row['category'],
                store=row['store'],
                product_url=row['product_url'] if pd.notna(row['product_url']) else None,
                image_url=row['image_url'] if pd.notna(row['image_url']) else None,
            )
            db.add(product)
            count += 1
        
        db.commit()
        return count
    
    except Exception as e:
        print(f"❌ Error importing {csv_path.name}: {e}")
        db.rollback()
        return 0


def import_store_csvs(store_folder: Path, store_name: str, db: Session) -> int:
    """
    Import all CSV files from a store folder
    
    Returns:
        Total number of products imported
    """
    total_count = 0
    
    # Import root level CSVs
    for csv_file in store_folder.glob("*.csv"):
        category = clean_category_name(csv_file.stem)
        count = import_csv_file(csv_file, store_name, category, db)
        total_count += count
        if count > 0:
            print(f"  ✅ {csv_file.name}: {count} products")
    
    # Import from subfolders
    for subfolder in store_folder.iterdir():
        if subfolder.is_dir():
            subfolder_category = clean_category_name(subfolder.name)
            
            for csv_file in subfolder.glob("*.csv"):
                # Combine subfolder and file name for category
                file_category = clean_category_name(csv_file.stem)
                category = f"{subfolder_category} - {file_category}"
                
                count = import_csv_file(csv_file, store_name, category, db)
                total_count += count
                if count > 0:
                    print(f"  ✅ {subfolder.name}/{csv_file.name}: {count} products")
    
    return total_count


def migrate_all_csvs(csv_base_path: Path) -> Dict[str, int]:
    """
    Migrate all CSV files to database
    
    Returns:
        Dict with store names and product counts
    """
    db = SessionLocal()
    
    stores_config = {
        'IGA': 'IGA',
        'Woolworths': 'Woolworths',
        'Coles': 'Coles'
    }
    
    results = {}
    
    try:
        for folder_name, store_name in stores_config.items():
            store_path = csv_base_path / folder_name
            
            if not store_path.exists():
                print(f"⚠️  {folder_name} folder not found, skipping...")
                continue
            
            print(f"\n📁 Importing {store_name} products...")
            count = import_store_csvs(store_path, store_name, db)
            results[store_name] = count
            print(f"✅ {store_name}: {count} total products imported")
    
    finally:
        db.close()
    
    return results
