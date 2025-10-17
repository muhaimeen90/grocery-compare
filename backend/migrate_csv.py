#!/usr/bin/env python3
"""
CSV to SQLite Migration Script

This script migrates all CSV files from the week 2 folder to a SQLite database.
Run this once to populate the database with initial data.
"""
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import init_db, engine
from app.utils.csv_importer import migrate_all_csvs
from app.config import settings
from app.models import Product


def main():
    """Main migration function"""
    print("=" * 80)
    print("🔄 CSV to SQLite Migration")
    print("=" * 80)
    
    # Create data directory if it doesn't exist
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Initialize database (create tables)
    print("\n📊 Initializing database...")
    init_db()
    print("✅ Database tables created")
    
    # Check if database already has data
    from app.database import SessionLocal
    db = SessionLocal()
    existing_count = db.query(Product).count()
    db.close()
    
    if existing_count > 0:
        print(f"\n⚠️  Database already contains {existing_count} products")
        response = input("Do you want to clear and reimport? (yes/no): ")
        if response.lower() == 'yes':
            print("\n🗑️  Clearing existing data...")
            Product.__table__.drop(engine)
            init_db()
            print("✅ Data cleared")
        else:
            print("❌ Migration cancelled")
            return
    
    # Run migration
    print(f"\n📁 Scanning CSV files in: {settings.CSV_DIR}")
    
    if not settings.CSV_DIR.exists():
        print(f"❌ CSV directory not found: {settings.CSV_DIR}")
        print("Please ensure the 'week 2' folder is in the correct location")
        return
    
    results = migrate_all_csvs(settings.CSV_DIR)
    
    # Print summary
    print("\n" + "=" * 80)
    print("📊 Migration Summary")
    print("=" * 80)
    
    total = 0
    for store, count in results.items():
        print(f"  {store}: {count:,} products")
        total += count
    
    print(f"\n✅ Total: {total:,} products imported successfully")
    print(f"📁 Database location: {settings.DATABASE_URL}")
    print("\n🎉 Migration completed!")


if __name__ == "__main__":
    main()
