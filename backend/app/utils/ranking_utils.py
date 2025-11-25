"""
Product Ranking Utilities for Search Results
"""
from typing import List, Dict, Any
import re


def calculate_relevance_score(
    product_name: str,
    product_brand: str,
    search_query: str,
    vector_score: float = 0.0,
    exact_match_bonus: float = 100.0,
    word_overlap_weight: float = 50.0,
    brand_match_weight: float = 30.0,
    vector_weight: float = 20.0
) -> float:
    """
    Calculate a comprehensive relevance score for a product based on multiple factors.
    
    Args:
        product_name: The name of the product
        product_brand: The brand of the product
        search_query: The user's search query
        vector_score: The semantic similarity score from vector search (0-1)
        exact_match_bonus: Points added for exact phrase match
        word_overlap_weight: Weight for word overlap percentage
        brand_match_weight: Weight for brand match
        vector_weight: Weight for vector similarity score
    
    Returns:
        A relevance score (higher is more relevant)
    """
    query_lower = search_query.lower().strip()
    name_lower = product_name.lower() if product_name else ""
    brand_lower = product_brand.lower() if product_brand else ""
    
    score = 0.0
    
    # 1. Exact phrase match (highest priority)
    if query_lower in name_lower:
        score += exact_match_bonus
        # Bonus for match at the beginning
        if name_lower.startswith(query_lower):
            score += exact_match_bonus * 0.5
    
    # 2. Word overlap score
    query_words = set(re.findall(r'\w+', query_lower))
    name_words = set(re.findall(r'\w+', name_lower))
    
    if query_words:
        overlap_count = len(query_words & name_words)
        overlap_percentage = overlap_count / len(query_words)
        score += overlap_percentage * word_overlap_weight
        
        # Bonus for all query words present
        if overlap_count == len(query_words):
            score += word_overlap_weight * 0.3
    
    # 3. Brand match
    if brand_lower and brand_lower in query_lower:
        score += brand_match_weight
    
    # 4. Vector similarity score (already considers semantic similarity)
    score += vector_score * vector_weight
    
    # 5. Word proximity bonus (words appearing close together)
    if len(query_words) > 1:
        proximity_bonus = calculate_proximity_bonus(name_lower, list(query_words))
        score += proximity_bonus * 10.0
    
    return score


def calculate_proximity_bonus(text: str, words: List[str]) -> float:
    """
    Calculate a bonus based on how close together the query words appear in the text.
    
    Args:
        text: The text to search in (lowercase)
        words: List of words to find (lowercase)
    
    Returns:
        A bonus score between 0 and 1
    """
    positions = {}
    for word in words:
        # Find all positions of this word
        word_positions = [m.start() for m in re.finditer(r'\b' + re.escape(word) + r'\b', text)]
        if word_positions:
            positions[word] = word_positions
    
    # If not all words found, no proximity bonus
    if len(positions) != len(words):
        return 0.0
    
    # Calculate minimum span that contains all words
    min_span = float('inf')
    for pos_list in positions.values():
        for pos in pos_list:
            # Find closest position for each other word
            span_positions = [pos]
            for other_word, other_positions in positions.items():
                if other_word in positions:
                    # Find closest position
                    closest = min(other_positions, key=lambda p: abs(p - pos))
                    span_positions.append(closest)
            
            span = max(span_positions) - min(span_positions)
            min_span = min(min_span, span)
    
    # Convert span to a bonus (shorter span = higher bonus)
    if min_span == float('inf'):
        return 0.0
    
    # Normalize: span of 0 (all same position) = 1.0, larger spans = lower bonus
    max_reasonable_span = 100
    bonus = max(0, 1.0 - (min_span / max_reasonable_span))
    return bonus


def rank_search_results(
    products: List[Any],
    vector_results: List[Dict[str, Any]],
    search_query: str,
    exact_match_bonus: float = 100.0,
    word_overlap_weight: float = 50.0,
    brand_match_weight: float = 30.0,
    vector_weight: float = 20.0
) -> List[Any]:
    """
    Rank search results by relevance, prioritizing exact matches and keyword overlap.
    
    Args:
        products: List of product objects from database
        vector_results: List of vector search results with scores
        search_query: The user's search query
        exact_match_bonus: Points for exact phrase match
        word_overlap_weight: Weight for word overlap
        brand_match_weight: Weight for brand match
        vector_weight: Weight for vector similarity
    
    Returns:
        List of products sorted by relevance score (highest first)
    """
    # Create a mapping of product_id to vector score
    vector_score_map = {}
    for result in vector_results:
        pid = result.get('product_id') or result.get('id')
        score = result.get('score', 0.0)
        if pid:
            vector_score_map[pid] = score
    
    # Calculate relevance score for each product
    scored_products = []
    for product in products:
        vector_score = vector_score_map.get(product.id, 0.0)
        
        relevance_score = calculate_relevance_score(
            product_name=product.name or "",
            product_brand=product.brand or "",
            search_query=search_query,
            vector_score=vector_score,
            exact_match_bonus=exact_match_bonus,
            word_overlap_weight=word_overlap_weight,
            brand_match_weight=brand_match_weight,
            vector_weight=vector_weight
        )
        
        scored_products.append((relevance_score, product))
    
    # Sort by relevance score (highest first)
    scored_products.sort(key=lambda x: x[0], reverse=True)
    
    # Return just the products
    return [product for score, product in scored_products]


def has_exact_match(product_name: str, search_query: str) -> bool:
    """
    Check if the product name contains an exact match of the search query.
    
    Args:
        product_name: The name of the product
        search_query: The user's search query
    
    Returns:
        True if exact match found, False otherwise
    """
    if not product_name or not search_query:
        return False
    
    return search_query.lower().strip() in product_name.lower()


def get_word_overlap_percentage(product_name: str, search_query: str) -> float:
    """
    Calculate the percentage of query words that appear in the product name.
    
    Args:
        product_name: The name of the product
        search_query: The user's search query
    
    Returns:
        Percentage of query words found (0.0 to 1.0)
    """
    if not product_name or not search_query:
        return 0.0
    
    query_words = set(re.findall(r'\w+', search_query.lower()))
    name_words = set(re.findall(r'\w+', product_name.lower()))
    
    if not query_words:
        return 0.0
    
    overlap = len(query_words & name_words)
    return overlap / len(query_words)
