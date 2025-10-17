"""
Price Scraping API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict
from datetime import datetime
import uuid
import asyncio

from ..database import get_db
from ..models import Product as ProductModel
from ..schemas import ScrapeRequest, BatchScrapeRequest, ScrapeResponse, ScrapeStatus
from ..services.scraper_service import scrape_product_price, scrape_products_batch

router = APIRouter(prefix="/api/scrape", tags=["scraping"])

# In-memory task storage (use Redis in production)
task_results: Dict[str, dict] = {}


@router.post("", response_model=ScrapeResponse)
async def scrape_price(
    request: ScrapeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Scrape live price for a single product
    """
    # Verify product exists
    product = db.query(ProductModel).filter(ProductModel.id == request.product_id).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if not product.product_url:
        raise HTTPException(status_code=400, detail="Product has no URL for scraping")
    
    # Generate task ID
    task_id = str(uuid.uuid4())
    
    # Initialize task status
    task_results[task_id] = {
        'task_id': task_id,
        'status': 'pending',
        'product_id': request.product_id,
        'message': 'Scraping queued'
    }
    
    # Add background task
    background_tasks.add_task(
        scrape_and_update_price,
        task_id=task_id,
        product_id=request.product_id,
        product_url=product.product_url,
        store=product.store
    )
    
    return ScrapeResponse(
        task_id=task_id,
        status='pending',
        product_id=request.product_id
    )


@router.get("/{task_id}", response_model=ScrapeStatus)
def get_scrape_status(task_id: str):
    """
    Get status of a scraping task
    """
    if task_id not in task_results:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return ScrapeStatus(**task_results[task_id])


@router.post("/batch", response_model=ScrapeResponse)
async def scrape_batch(
    request: BatchScrapeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Scrape multiple products concurrently
    """
    # Verify all products exist
    products = db.query(ProductModel).filter(
        ProductModel.id.in_(request.product_ids)
    ).all()
    
    if len(products) != len(request.product_ids):
        raise HTTPException(status_code=404, detail="One or more products not found")
    
    # Check all have URLs
    products_without_urls = [p.id for p in products if not p.product_url]
    if products_without_urls:
        raise HTTPException(
            status_code=400,
            detail=f"Products without URLs: {products_without_urls}"
        )
    
    # Generate task ID
    task_id = str(uuid.uuid4())
    
    # Initialize task status
    task_results[task_id] = {
        'task_id': task_id,
        'status': 'pending',
        'total': len(request.product_ids),
        'message': 'Batch scraping queued'
    }
    
    # Prepare product data
    products_data = [
        {
            'id': p.id,
            'url': p.product_url,
            'store': p.store
        }
        for p in products
    ]
    
    # Add background task
    background_tasks.add_task(
        scrape_batch_and_update,
        task_id=task_id,
        products_data=products_data
    )
    
    return ScrapeResponse(
        task_id=task_id,
        status='pending',
        total=len(request.product_ids)
    )


async def scrape_and_update_price(
    task_id: str,
    product_id: int,
    product_url: str,
    store: str
):
    """
    Background task to scrape price and update database
    """
    # Update status to scraping
    task_results[task_id]['status'] = 'scraping'
    task_results[task_id]['message'] = 'Scraping in progress...'
    
    try:
        # Scrape price
        result = await scrape_product_price(product_url, store)
        
        if result['status'] == 'success':
            # Update database
            from ..database import SessionLocal
            from ..utils.price_parser import extract_numeric_price
            
            db = SessionLocal()
            try:
                product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
                if product:
                    product.price = result['price']
                    product.price_numeric = extract_numeric_price(result['price'])
                    product.last_scraped = datetime.utcnow()
                    product.updated_at = datetime.utcnow()
                    db.commit()
                    
                    task_results[task_id] = {
                        'task_id': task_id,
                        'status': 'success',
                        'price': result['price'],
                        'product_id': product_id,
                        'message': 'Price updated successfully',
                        'completed_at': datetime.utcnow()
                    }
                else:
                    task_results[task_id] = {
                        'task_id': task_id,
                        'status': 'error',
                        'product_id': product_id,
                        'message': 'Product not found in database',
                        'completed_at': datetime.utcnow()
                    }
            finally:
                db.close()
        else:
            task_results[task_id] = {
                'task_id': task_id,
                'status': 'error',
                'product_id': product_id,
                'message': result.get('message', 'Scraping failed'),
                'completed_at': datetime.utcnow()
            }
    
    except Exception as e:
        task_results[task_id] = {
            'task_id': task_id,
            'status': 'error',
            'product_id': product_id,
            'message': f'Error: {str(e)}',
            'completed_at': datetime.utcnow()
        }


async def scrape_batch_and_update(task_id: str, products_data: list):
    """
    Background task to scrape multiple products
    """
    task_results[task_id]['status'] = 'scraping'
    task_results[task_id]['message'] = 'Batch scraping in progress...'
    
    try:
        # Scrape all products
        results = await scrape_products_batch(products_data)
        
        # Update database for successful scrapes
        from ..database import SessionLocal
        from ..utils.price_parser import extract_numeric_price
        
        db = SessionLocal()
        try:
            success_count = 0
            for product_data, result in zip(products_data, results):
                if result['status'] == 'success':
                    product = db.query(ProductModel).filter(
                        ProductModel.id == product_data['id']
                    ).first()
                    
                    if product:
                        product.price = result['price']
                        product.price_numeric = extract_numeric_price(result['price'])
                        product.last_scraped = datetime.utcnow()
                        product.updated_at = datetime.utcnow()
                        success_count += 1
            
            db.commit()
            
            task_results[task_id] = {
                'task_id': task_id,
                'status': 'success',
                'message': f'Updated {success_count}/{len(products_data)} products',
                'total': len(products_data),
                'completed_at': datetime.utcnow()
            }
        finally:
            db.close()
    
    except Exception as e:
        task_results[task_id] = {
            'task_id': task_id,
            'status': 'error',
            'message': f'Error: {str(e)}',
            'total': len(products_data),
            'completed_at': datetime.utcnow()
        }
