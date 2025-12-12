export interface Product {
  id: number;
  name: string;
  price: string;
  price_numeric: number | null;
  brand: string | null;
  size: string | null;
  category: string;
  store: string;
  product_url: string | null;
  image_url: string | null;
  last_scraped: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductList {
  products: Product[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface ScrapeStatus {
  task_id: string;
  status: 'pending' | 'scraping' | 'success' | 'error';
  price?: string;
  message?: string;
  product_id?: number;
  completed_at?: string;
}

export interface FilterOptions {
  store?: string;
  category?: string;
  search?: string;
  brand?: string;
  sort?: 'name' | 'price_low' | 'price_high';
  page?: number;
  limit?: number;
}

export interface CartItem {
  id: number;
  cart_id: number;
  product_id: number;
  quantity: number;
}

export interface ProductWithApproval extends Product {
  needs_approval: boolean;
  identical_score: number | null;
  size_matched: boolean;
  brand_matched: boolean;
  is_fallback?: boolean;
  fallback_type?: 'same_brand_diff_size' | 'same_size_diff_brand' | null;
}

export interface CartItemWithAlternatives extends Product {
  cart_item_id: number;
  quantity: number;
  alternative_prices: ProductWithApproval[];
}

// Cart Comparison Types
export interface ProductMatch {
  original_product: Product;
  matched_product: Product | null;
  is_available: boolean;
  similarity_score?: number;
  needs_approval?: boolean;
  size_matched?: boolean;
  brand_matched?: boolean;
  is_fallback?: boolean;
  fallback_type?: 'same_brand_diff_size' | 'same_size_diff_brand' | null;
}

export interface StoreComparison {
  store: string;
  products: ProductMatch[];
  total: number;
  available_count: number;
  missing_count: number;
}

export interface BestDealItem {
  original_product: Product;
  best_product: Product;
  store: string;
  price: number;
  savings: number;
}

export interface CompareResponse {
  store_comparisons: StoreComparison[];
  best_deal: BestDealItem[];
  best_deal_total: number;
  best_deal_savings: number;
}
