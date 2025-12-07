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


# ============== Identical Product Matching Utilities ==============

def calculate_identical_product_score(
    original_size: str,
    original_brand: str,
    candidate_size: str,
    candidate_brand: str,
    vector_score: float,
    size_match_bonus: float = 50.0,
    brand_match_bonus: float = 40.0,
    size_mismatch_penalty: float = 80.0,
    brand_mismatch_penalty: float = 30.0,
) -> tuple[float, bool, bool]:
    """
    Calculate a score for how identical a candidate product is to the original.
    Uses strict matching for size and brand fields (already normalized).
    
    Args:
        original_size: Size of the original product (e.g., "1.25l", "4x250ml")
        original_brand: Brand of the original product
        candidate_size: Size of the candidate product
        candidate_brand: Brand of the candidate product
        vector_score: The semantic similarity score from vector search (0-1)
        size_match_bonus: Points added for exact size match
        brand_match_bonus: Points added for exact brand match
        size_mismatch_penalty: Points deducted for size mismatch
        brand_mismatch_penalty: Points deducted for brand mismatch
    
    Returns:
        Tuple of (final_score, size_matched, brand_matched)
    """
    # Start with the vector similarity score (normalized to 0-100 scale)
    score = vector_score * 100.0
    
    # Strict size comparison (fields are pre-normalized)
    orig_size_clean = (original_size or "").strip().lower()
    cand_size_clean = (candidate_size or "").strip().lower()
    
    size_matched = False
    if orig_size_clean and cand_size_clean:
        if orig_size_clean == cand_size_clean:
            score += size_match_bonus
            size_matched = True
        else:
            score -= size_mismatch_penalty
    elif orig_size_clean or cand_size_clean:
        # One has size, one doesn't - penalize but less severely
        score -= size_mismatch_penalty * 0.5
    # If both are empty, no penalty (unknown sizes)
    
    # Strict brand comparison (fields are pre-normalized)
    orig_brand_clean = (original_brand or "").strip().lower()
    cand_brand_clean = (candidate_brand or "").strip().lower()
    
    brand_matched = False
    if orig_brand_clean and cand_brand_clean:
        if orig_brand_clean == cand_brand_clean:
            score += brand_match_bonus
            brand_matched = True
        else:
            score -= brand_mismatch_penalty
    elif orig_brand_clean or cand_brand_clean:
        # One has brand, one doesn't - small penalty
        score -= brand_mismatch_penalty * 0.3
    # If both are empty, no penalty
    
    # Normalize score back to 0-1 range
    # Max possible: 100 + 50 + 40 = 190
    # Min possible: 0 - 80 - 30 = -110
    # Normalize to 0-1 with some buffer
    normalized_score = max(0.0, min(1.0, (score + 110) / 300))
    
    return normalized_score, size_matched, brand_matched


def rank_identical_products(
    original_product: dict,
    candidates: List[dict],
    size_match_bonus: float = 50.0,
    brand_match_bonus: float = 40.0,
    size_mismatch_penalty: float = 80.0,
    brand_mismatch_penalty: float = 30.0,
    auto_approve_threshold: float = 0.75,
    minimum_score: float = 0.40,
) -> List[dict]:
    """
    Rank candidate products by how identical they are to the original product.
    Returns one best match per store with approval status.
    
    Args:
        original_product: Dict with keys 'size', 'brand', 'store'
        candidates: List of candidate products with 'size', 'brand', 'store', 'similarity_score'
        size_match_bonus: Points for exact size match
        brand_match_bonus: Points for exact brand match
        size_mismatch_penalty: Points deducted for size mismatch
        brand_mismatch_penalty: Points deducted for brand mismatch
        auto_approve_threshold: Score above this = auto-approved
        minimum_score: Score below this = not returned at all
    
    Returns:
        List of best candidates per store with 'needs_approval' flag
    """
    original_size = original_product.get('size', '')
    original_brand = original_product.get('brand', '')
    original_store = original_product.get('store', '')
    
    # Score all candidates
    scored_candidates = []
    for candidate in candidates:
        # Skip if same store as original
        if candidate.get('store') == original_store:
            continue
            
        vector_score = candidate.get('similarity_score', 0.0)
        
        final_score, size_matched, brand_matched = calculate_identical_product_score(
            original_size=original_size,
            original_brand=original_brand,
            candidate_size=candidate.get('size', ''),
            candidate_brand=candidate.get('brand', ''),
            vector_score=vector_score,
            size_match_bonus=size_match_bonus,
            brand_match_bonus=brand_match_bonus,
            size_mismatch_penalty=size_mismatch_penalty,
            brand_mismatch_penalty=brand_mismatch_penalty,
        )
        
        # Skip if below minimum threshold
        if final_score < minimum_score:
            continue
        
        # Determine if this needs user approval
        needs_approval = final_score < auto_approve_threshold
        
        scored_candidates.append({
            **candidate,
            'identical_score': final_score,
            'size_matched': size_matched,
            'brand_matched': brand_matched,
            'needs_approval': needs_approval,
        })
    
    # Sort by score descending
    scored_candidates.sort(key=lambda x: x['identical_score'], reverse=True)
    
    # Keep only the best match per store
    best_per_store = {}
    for candidate in scored_candidates:
        store = candidate.get('store')
        if store and store not in best_per_store:
            best_per_store[store] = candidate
    
    return list(best_per_store.values())
