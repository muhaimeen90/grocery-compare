#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal
from app.models import Product

db = SessionLocal()

try:
    # Update product by name
    product_name = "Canon RF 800mm f/5.6L IS USM Lens"  # Replace with actual product name
    product = db.query(Product).filter(Product.name == product_name).first()
    
    if product:
        product.price = "$30304.05"
        product.price_numeric = 30304.05
        
        db.commit()
        print(f"✅ Updated product: {product.name}")
    else:
        print(f"❌ Product '{product_name}' not found")
        
finally:
    db.close()
