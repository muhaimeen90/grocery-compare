"""
Price Scraper Service - Live price scraping using Playwright
"""
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from typing import Dict, List, Any
import asyncio
from datetime import datetime
import re


async def scrape_woolworths_price(page, url: str) -> Dict[str, Any]:
    """Scrape price from Woolworths product page"""
    try:
        print(f"🔍 Scraping Woolworths: {url}")
        
        # Set user agent to avoid bot detection
        await page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        
        # Wait a bit for dynamic content
        await page.wait_for_timeout(2000)
        
        # Try multiple selector strategies
        price_selectors = [
            # New Woolworths selectors (2024-2025)
            '[data-testid="price-container"]',
            '[class*="price-container"]',
            '[class*="Price"]',
            '.price-dollars',
            '[data-testid="price-dollars"]',
            '.shelfProductTile-price',
            '[class*="shelfProductTile-price"]',
            # Fallback to any element with price-like content
            'span:has-text("$")',
            'div:has-text("$")'
        ]
        
        for selector in price_selectors:
            try:
                price_element = await page.wait_for_selector(selector, timeout=3000)
                if price_element:
                    price_text = await price_element.inner_text()
                    # Extract price using regex
                    price_match = re.search(r'\$?\s*(\d+\.?\d*)', price_text)
                    if price_match:
                        price_value = price_match.group(1)
                        print(f"✅ Found price: ${price_value}")
                        return {
                            'status': 'success',
                            'price': f"${price_value}",
                            'scraped_at': datetime.utcnow().isoformat()
                        }
            except Exception as e:
                print(f"  ⏭️  Selector {selector} failed: {e}")
                continue
        
        # Last resort: search entire page content for price pattern
        content = await page.content()
        price_matches = re.findall(r'\$\s*(\d+\.\d{2})', content)
        if price_matches:
            print(f"✅ Found price in content: ${price_matches[0]}")
            return {
                'status': 'success',
                'price': f"${price_matches[0]}",
                'scraped_at': datetime.utcnow().isoformat()
            }
        
        print("❌ Price element not found")
        return {'status': 'error', 'message': 'Price element not found'}
    
    except PlaywrightTimeout:
        print("❌ Page load timeout")
        return {'status': 'error', 'message': 'Page load timeout'}
    except Exception as e:
        print(f"❌ Error: {e}")
        return {'status': 'error', 'message': str(e)}


async def scrape_coles_price(page, url: str) -> Dict[str, Any]:
    """Scrape price from Coles product page"""
    try:
        print(f"🔍 Scraping Coles: {url}")
        
        # Set user agent
        await page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        
        # Wait for content
        await page.wait_for_timeout(2000)
        
        # Updated Coles selectors
        price_selectors = [
            '[data-testid="product-pricing"]',
            '[class*="product-pricing"]',
            '[class*="Price"]',
            '.price__value',
            '[data-testid="product-price"]',
            '.product-price',
            '[class*="dollar"]',
            '[class*="price"]',
            'span:has-text("$")',
            'div:has-text("$")'
        ]
        
        for selector in price_selectors:
            try:
                price_element = await page.wait_for_selector(selector, timeout=3000)
                if price_element:
                    price_text = await price_element.inner_text()
                    # Extract price using regex
                    price_match = re.search(r'\$?\s*(\d+\.?\d*)', price_text)
                    if price_match:
                        price_value = price_match.group(1)
                        print(f"✅ Found price: ${price_value}")
                        return {
                            'status': 'success',
                            'price': f"${price_value}",
                            'scraped_at': datetime.utcnow().isoformat()
                        }
            except Exception as e:
                print(f"  ⏭️  Selector {selector} failed: {e}")
                continue
        
        # Last resort: search page content
        content = await page.content()
        price_matches = re.findall(r'\$\s*(\d+\.\d{2})', content)
        if price_matches:
            print(f"✅ Found price in content: ${price_matches[0]}")
            return {
                'status': 'success',
                'price': f"${price_matches[0]}",
                'scraped_at': datetime.utcnow().isoformat()
            }
        
        print("❌ Price element not found")
        return {'status': 'error', 'message': 'Price element not found'}
    
    except PlaywrightTimeout:
        print("❌ Page load timeout")
        return {'status': 'error', 'message': 'Page load timeout'}
    except Exception as e:
        print(f"❌ Error: {e}")
        return {'status': 'error', 'message': str(e)}


async def scrape_iga_price(page, url: str) -> Dict[str, Any]:
    """Scrape price from IGA product page"""
    try:
        print(f"🔍 Scraping IGA: {url}")
        
        # Set user agent
        await page.set_extra_http_headers({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        
        # Wait for content
        await page.wait_for_timeout(2000)
        
        # IGA selector strategies
        price_selectors = [
            '[class*="product-price"]',
            '[class*="Price"]',
            '[data-testid="price"]',
            '.product-price',
            '.price',
            '[class*="price"]',
            '[class*="dollar"]',
            'span:has-text("$")',
            'div:has-text("$")'
        ]
        
        for selector in price_selectors:
            try:
                price_element = await page.wait_for_selector(selector, timeout=3000)
                if price_element:
                    price_text = await price_element.inner_text()
                    # Extract price using regex
                    price_match = re.search(r'\$?\s*(\d+\.?\d*)', price_text)
                    if price_match:
                        price_value = price_match.group(1)
                        print(f"✅ Found price: ${price_value}")
                        return {
                            'status': 'success',
                            'price': f"${price_value}",
                            'scraped_at': datetime.utcnow().isoformat()
                        }
            except Exception as e:
                print(f"  ⏭️  Selector {selector} failed: {e}")
                continue
        
        # Last resort: search page content
        content = await page.content()
        price_matches = re.findall(r'\$\s*(\d+\.\d{2})', content)
        if price_matches:
            print(f"✅ Found price in content: ${price_matches[0]}")
            return {
                'status': 'success',
                'price': f"${price_matches[0]}",
                'scraped_at': datetime.utcnow().isoformat()
            }
        
        print("❌ Price element not found")
        return {'status': 'error', 'message': 'Price element not found'}
    
    except PlaywrightTimeout:
        print("❌ Page load timeout")
        return {'status': 'error', 'message': 'Page load timeout'}
    except Exception as e:
        print(f"❌ Error: {e}")
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
        print(f"\n🚀 Starting scrape: {store} - {product_url}")
        
        async with async_playwright() as p:
            # Launch browser with additional options to avoid detection
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox'
                ]
            )
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            
            page = await context.new_page()
            
            # Route to appropriate scraper based on store
            store_lower = store.lower()
            if 'woolworths' in store_lower or 'woolies' in store_lower:
                result = await scrape_woolworths_price(page, product_url)
            elif 'coles' in store_lower:
                result = await scrape_coles_price(page, product_url)
            elif 'iga' in store_lower:
                result = await scrape_iga_price(page, product_url)
            else:
                result = {'status': 'error', 'message': f'Unknown store: {store}'}
            
            await browser.close()
            print(f"✅ Scraping complete: {result['status']}")
            return result
    
    except Exception as e:
        error_msg = f'Scraping error: {str(e)}'
        print(f"❌ {error_msg}")
        return {
            'status': 'error',
            'message': error_msg
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
        print(f"\n🚀 Starting batch scrape: {len(products_data)} products")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-sandbox'
                ]
            )
            
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            
            # Create tasks for concurrent scraping
            async def scrape_single(product_data):
                page = await context.new_page()
                try:
                    store_lower = product_data['store'].lower()
                    if 'woolworths' in store_lower or 'woolies' in store_lower:
                        result = await scrape_woolworths_price(page, product_data['url'])
                    elif 'coles' in store_lower:
                        result = await scrape_coles_price(page, product_data['url'])
                    elif 'iga' in store_lower:
                        result = await scrape_iga_price(page, product_data['url'])
                    else:
                        result = {'status': 'error', 'message': 'Unknown store'}
                    
                    result['product_id'] = product_data.get('id')
                    return result
                except Exception as e:
                    return {
                        'status': 'error',
                        'message': str(e),
                        'product_id': product_data.get('id')
                    }
                finally:
                    await page.close()
            
            # Run all scraping tasks concurrently
            tasks = [scrape_single(product) for product in products_data]
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
                    processed_results.append(result)
            
            print(f"✅ Batch scrape complete: {len(processed_results)} results")
            return processed_results
    
    except Exception as e:
        error_msg = f'Batch scraping error: {str(e)}'
        print(f"❌ {error_msg}")
        return [
            {'status': 'error', 'message': error_msg, 'product_id': p.get('id')}
            for p in products_data
        ]
