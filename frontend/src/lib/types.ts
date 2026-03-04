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
  product?: Product;
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
  mismatch_reason?: string | null;
}

export interface StoreComparison {
  store: string;
  products: ProductMatch[];
  total: number;
  available_count: number;
  missing_count: number;
  travel_info?: TravelInfo | null;
  total_with_travel?: number | null;
}

export interface BestDealItem {
  original_product: Product;
  best_product: Product;
  store: string;
  price: number;
  savings: number;
  mismatch_reason?: string | null;
}

export interface SingleStoreOption {
  store: string;
  products: ProductMatch[];
  total: number;
  available_count: number;
  missing_count: number;
  travel_info?: TravelInfo | null;
  total_with_travel?: number | null;
}

export interface TwoStoreOption {
  stores: string[];
  products: ProductMatch[];
  total: number;
  available_count: number;
  missing_count: number;
  travel_info?: TravelInfo | null;
  total_with_travel?: number | null;
}

export interface CompareResponse {
  store_comparisons: StoreComparison[];
  best_deal: BestDealItem[];
  best_deal_total: number;
  best_deal_savings: number;
  best_single_store: SingleStoreOption;
  best_two_stores: TwoStoreOption;
  transport_mode?: string | null;
  recommendation?: string | null;
}

// Location Types
export interface Store {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: number;
  store_id: number;
  external_store_id: string | null;
  name: string;
  address: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  opening_hours: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  store: Store;
  distance_km?: number;
}

export interface NearbyLocationsResponse {
  locations: Location[];
  search_point: {
    lat: number;
    lng: number;
  };
  total: number;
}

// Travel Cost Types
export interface TravelInfo {
  distance_km: number;
  duration_min: number;
  fuel_or_fare_cost: number;
  time_cost: number;
  total_cost: number;
  route_description: string;
  mode: string;
}

export interface StoreLocationInput {
  store_name: string;
  lat: number;
  lng: number;
}

export interface StoreTravelPreview {
  store_name: string;
  travel_info: TravelInfo;
}

export interface TravelMatrixResponse {
  stores: StoreTravelPreview[];
  transport_mode: string;
}
