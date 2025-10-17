"""
Price Scraper Service - Live price scraping using Playwright
"""
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from typing import Dict, List, Any
import asyncio
from datetime import datetime


async def scrape_woolworths_price(page, url: str) -> Dict[str, Any]:
    """Scrape price from Woolworths product page"""
    try:
        await page.goto(url, wait_until='networkidle', timeout=30000)
        
        # Try multiple selectors
        price_selectors = [
            '.price-dollars',
            '[data-testid="price-dollars"]',
            '.price',
            '[class*="price"]'
        ]
        
        for selector in price_selectors:
            try:
                price_element = await page.wait_for_selector(selector, timeout=5000)
                if price_element:
                    price_text = await price_element.inner_text()
                    return {
                        'status': 'success',
                        'price': price_text.strip(),
                        'scraped_at': datetime.utcnow().isoformat()
                    }
            except:
                continue
        
        return {'status': 'error', 'message': 'Price element not found'}
    
    except PlaywrightTimeout:
        return {'status': 'error', 'message': 'Page load timeout'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


async def scrape_coles_price(page, url: str) -> Dict[str, Any]:
    """Scrape price from Coles product page"""
    try:
        await page.goto(url, wait_until='networkidle', timeout=30000)
        
        price_selectors = [
            '.price__value',
            '[data-testid="product-price"]',
            '.product-price',
            '[class*="price"]'
        ]
        
        for selector in price_selectors:
            try:
                price_element = await page.wait_for_selector(selector, timeout=5000)
                if price_element:
                    price_text = await price_element.inner_text()
                    return {
                        'status': 'success',
                        'price': price_text.strip(),
                        'scraped_at': datetime.utcnow().isoformat()
                    }
            except:
                continue
        
        return {'status': 'error', 'message': 'Price element not found'}
    
    except PlaywrightTimeout:
        return {'status': 'error', 'message': 'Page load timeout'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


async def scrape_iga_price(page, url: str) -> Dict[str, Any]:
    """Scrape price from IGA product page"""
    try:
        await page.goto(url, wait_until='networkidle', timeout=30000)
        
        price_selectors = [
            '.product-price',
            '[class*="price"]',
            '.price'
        ]
        
        for selector in price_selectors:
            try:
                price_element = await page.wait_for_selector(selector, timeout=5000)
                if price_element:
                    price_text = await price_element.inner_text()
                    return {
                        'status': 'success',
                        'price': price_text.strip(),
                        'scraped_at': datetime.utcnow().isoformat()
                    }
            except:
                continue
        
        return {'status': 'error', 'message': 'Price element not found'}
    
    except PlaywrightTimeout:
        return {'status': 'error', 'message': 'Page load timeout'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}


async def scrape_product_price(product_url: str, store: str) -> Dict[str, Any]:
    """
    Scrape price for a single product
    
    Args:
        product_url: Product URL to scrape
        store: Store name (IGA, Woolworths, Coles)
    
    Returns:
        Dict with price and status information
    """
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            # Route to appropriate scraper based on store
            if store.lower() == 'woolworths':
                result = await scrape_woolworths_price(page, product_url)
            elif store.lower() == 'coles':
                result = await scrape_coles_price(page, product_url)
            elif store.lower() == 'iga':
                result = await scrape_iga_price(page, product_url)
            else:
                result = {'status': 'error', 'message': f'Unknown store: {store}'}
            
            await browser.close()
            return result
    
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
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            
            # Create tasks for concurrent scraping
            tasks = []
            for product in products_data:
                page = await browser.new_page()
                
                if product['store'].lower() == 'woolworths':
                    task = scrape_woolworths_price(page, product['url'])
                elif product['store'].lower() == 'coles':
                    task = scrape_coles_price(page, product['url'])
                elif product['store'].lower() == 'iga':
                    task = scrape_iga_price(page, product['url'])
                else:
                    task = asyncio.create_task(
                        asyncio.coroutine(lambda: {'status': 'error', 'message': 'Unknown store'})()
                    )
                
                tasks.append(task)
            
            # Run all scraping tasks concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            await browser.close()
            
            # Process results
            processed_results = []
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    processed_results.append({
                        'status': 'error',
                        'message': str(result),
                        'product_id': products_data[i].get('id')
                    })
                else:
                    result['product_id'] = products_data[i].get('id')
                    processed_results.append(result)
            
            return processed_results
    
    except Exception as e:
        return [
            {'status': 'error', 'message': f'Batch scraping error: {str(e)}'}
            for _ in products_data
        ]
