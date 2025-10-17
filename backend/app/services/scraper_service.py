"""
Price Scraper Service - Wraps price_scrapers.py functionality
"""
import sys
from pathlib import Path
from typing import Dict, List, Any

# Add week 2 directory to path to import price_scrapers
week2_path = Path(__file__).resolve().parent.parent.parent.parent / "week 2"
sys.path.insert(0, str(week2_path))

try:
    from price_scrapers import main_concurrent_scraper
except ImportError as e:
    print(f"Warning: Could not import price_scrapers: {e}")
    main_concurrent_scraper = None


async def scrape_product_price(product_url: str, store: str) -> Dict[str, Any]:
    """
    Scrape price for a single product
    
    Args:
        product_url: Product URL to scrape
        store: Store name (IGA, Woolworths, Coles)
    
    Returns:
        Dict with price and status information
    """
    if not main_concurrent_scraper:
        return {
            'status': 'error',
            'message': 'Scraper not available'
        }
    
    try:
        # Use the concurrent scraper from price_scrapers.py
        urls_and_stores = [(product_url, store)]
        results = await main_concurrent_scraper(urls_and_stores)
        
        if results and len(results) > 0:
            return results[0]
        else:
            return {
                'status': 'error',
                'message': 'No result returned from scraper'
            }
    
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Scraping error: {str(e)}'
        }


async def scrape_products_batch(products_data: List[Dict]) -> List[Dict[str, Any]]:
    """
    Scrape prices for multiple products concurrently
    
    Args:
        products_data: List of dicts with 'id', 'url', and 'store' keys
    
    Returns:
        List of result dicts
    """
    if not main_concurrent_scraper:
        return [
            {'status': 'error', 'message': 'Scraper not available'}
            for _ in products_data
        ]
    
    try:
        # Prepare URLs and stores for concurrent scraper
        urls_and_stores = [
            (product['url'], product['store'])
            for product in products_data
        ]
        
        # Use the concurrent scraper
        results = await main_concurrent_scraper(urls_and_stores)
        
        return results
    
    except Exception as e:
        return [
            {'status': 'error', 'message': f'Batch scraping error: {str(e)}'}
            for _ in products_data
        ]
