"""
Populate stores and locations tables from CSV files in data/Locations/
Handles inconsistent CSV structures across different store chains
"""
import csv
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Store, Location
from app.config import settings

# Database connection
DATABASE_URL = settings.DATABASE_URL
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def normalize_store_name(filename: str) -> str:
    """Extract store name from CSV filename"""
    lower = filename.lower()
    if 'aldi' in lower:
        return 'Aldi'
    elif 'coles' in lower:
        return 'Coles'
    elif 'woolworths' in lower:
        return 'Woolworths'
    elif 'iga' in lower:
        return 'IGA'
    else:
        raise ValueError(f"Unknown store in filename: {filename}")


def populate_stores(session):
    """Create the 4 store chain records"""
    stores = ['Aldi', 'Coles', 'IGA', 'Woolworths']
    
    for store_name in stores:
        existing = session.query(Store).filter_by(name=store_name).first()
        if not existing:
            store = Store(name=store_name)
            session.add(store)
            print(f"Created store: {store_name}")
        else:
            print(f"Store already exists: {store_name}")
    
    session.commit()


def parse_aldi_csv(csv_path: Path, store_id: int, session):
    """Parse Aldi CSV format"""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            # Combine address components
            address_parts = [
                row.get('address1', ''),
                row.get('address2', ''),
                row.get('address3', '')
            ]
            address = ', '.join([p.strip() for p in address_parts if p.strip()])
            
            location = Location(
                store_id=store_id,
                external_store_id=row.get('store_id'),
                name=row.get('name', '').strip(),
                address=address or None,
                suburb=row.get('city') or row.get('district'),
                state=row.get('state_code') or row.get('state'),
                postcode=row.get('postcode'),
                latitude=float(row['latitude']) if row.get('latitude') else None,
                longitude=float(row['longitude']) if row.get('longitude') else None,
                phone=row.get('phone') or None,
                opening_hours=row.get('opening_hours') or None,
                is_active=True
            )
            session.add(location)
            count += 1
    
    session.commit()
    print(f"  Imported {count} Aldi locations")


def parse_coles_csv(csv_path: Path, store_id: int, session):
    """Parse Coles CSV format"""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            # Coles has brand field - filter for actual Coles stores
            brand = row.get('brand', '').lower()
            if 'coles' not in brand:
                continue  # Skip Liquorland and other brands
            
            location = Location(
                store_id=store_id,
                external_store_id=row.get('store_id'),
                name=row.get('name', '').strip(),
                address=row.get('address') or None,
                suburb=row.get('suburb') or None,
                state=row.get('state') or None,
                postcode=row.get('postcode') or None,
                latitude=float(row['latitude']) if row.get('latitude') else None,
                longitude=float(row['longitude']) if row.get('longitude') else None,
                phone=row.get('phone') or None,
                opening_hours=row.get('trading_hours') or None,
                is_active=True
            )
            session.add(location)
            count += 1
    
    session.commit()
    print(f"  Imported {count} Coles locations")


def parse_woolworths_csv(csv_path: Path, store_id: int, session):
    """Parse Woolworths CSV format"""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            # Woolworths has division field - filter for supermarkets
            division = row.get('division', '').upper()
            if division not in ['SUPERMARKETS', 'METRO', '']:
                continue  # Skip EG (petrol) and other divisions
            
            # Combine address lines
            address_parts = [
                row.get('address_line1', ''),
                row.get('address_line2', '')
            ]
            address = ', '.join([p.strip() for p in address_parts if p.strip()])
            
            location = Location(
                store_id=store_id,
                external_store_id=row.get('store_no'),
                name=row.get('name', '').strip(),
                address=address or None,
                suburb=row.get('suburb') or None,
                state=row.get('state') or None,
                postcode=row.get('postcode') or None,
                latitude=float(row['latitude']) if row.get('latitude') else None,
                longitude=float(row['longitude']) if row.get('longitude') else None,
                phone=row.get('phone') or None,
                opening_hours=row.get('trading_hours') or None,
                is_active=True
            )
            session.add(location)
            count += 1
    
    session.commit()
    print(f"  Imported {count} Woolworths locations")


def parse_iga_csv(csv_path: Path, store_id: int, session):
    """Parse IGA CSV format"""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        for row in reader:
            # Combine address lines
            address_parts = [
                row.get('address_line1', ''),
                row.get('address_line2', '')
            ]
            address = ', '.join([p.strip() for p in address_parts if p.strip()])
            
            location = Location(
                store_id=store_id,
                external_store_id=row.get('store_id') or row.get('retailer_store_id'),
                name=row.get('name', '').strip(),
                address=address or None,
                suburb=row.get('city') or None,
                state=row.get('state') or None,
                postcode=row.get('postcode') or None,
                latitude=float(row['latitude']) if row.get('latitude') else None,
                longitude=float(row['longitude']) if row.get('longitude') else None,
                phone=row.get('phone') or None,
                opening_hours=row.get('opening_hours') or None,
                is_active=True
            )
            session.add(location)
            count += 1
    
    session.commit()
    print(f"  Imported {count} IGA locations")


def import_locations(session):
    """Import all location CSV files"""
    data_dir = Path(__file__).parent / 'data' / 'Locations'
    
    if not data_dir.exists():
        print(f"Error: Directory not found: {data_dir}")
        return
    
    # Get store IDs from database
    stores = {s.name: s.id for s in session.query(Store).all()}
    
    # Process CSV files
    csv_files = list(data_dir.glob('*.csv'))
    print(f"\nFound {len(csv_files)} CSV files in {data_dir}")
    
    for csv_file in sorted(csv_files):
        print(f"\nProcessing: {csv_file.name}")
        try:
            store_name = normalize_store_name(csv_file.name)
            store_id = stores.get(store_name)
            
            if not store_id:
                print(f"  Warning: Store '{store_name}' not found in database")
                continue
            
            # Parse based on store type
            if store_name == 'Aldi':
                parse_aldi_csv(csv_file, store_id, session)
            elif store_name == 'Coles':
                parse_coles_csv(csv_file, store_id, session)
            elif store_name == 'Woolworths':
                parse_woolworths_csv(csv_file, store_id, session)
            elif store_name == 'IGA':
                parse_iga_csv(csv_file, store_id, session)
                
        except Exception as e:
            print(f"  Error processing {csv_file.name}: {e}")
            session.rollback()


def main():
    """Main execution"""
    print("=" * 60)
    print("POPULATE STORES AND LOCATIONS")
    print("=" * 60)
    
    session = SessionLocal()
    
    try:
        print("\n1. Creating store chains...")
        populate_stores(session)
        
        print("\n2. Importing store locations from CSVs...")
        import_locations(session)
        
        # Summary
        total_stores = session.query(Store).count()
        total_locations = session.query(Location).count()
        
        print("\n" + "=" * 60)
        print("IMPORT COMPLETE")
        print("=" * 60)
        print(f"Total store chains: {total_stores}")
        print(f"Total locations: {total_locations}")
        
        # Breakdown by store
        for store in session.query(Store).all():
            count = session.query(Location).filter_by(store_id=store.id).count()
            print(f"  {store.name}: {count} locations")
        
    except Exception as e:
        print(f"\nError: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
