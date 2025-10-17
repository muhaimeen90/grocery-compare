"""
Price parsing utilities
"""
import re


def extract_numeric_price(price_str: str) -> float:
    """
    Extract numeric value from price string
    
    Args:
        price_str: Price string (e.g., "$12.99", "$2.50 each")
    
    Returns:
        Numeric price value
    """
    if not price_str:
        return 0.0
    
    # Remove currency symbols and clean string
    cleaned = str(price_str).replace('$', '').replace(',', '').strip()
    
    # Extract first numeric value (handles cases like "$2.50 each")
    match = re.search(r'(\d+\.?\d*)', cleaned)
    
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return 0.0
    
    return 0.0
