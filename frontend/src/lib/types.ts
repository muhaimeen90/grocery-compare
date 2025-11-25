export interface Product {
  id: number;
  name: string;
  price: string;
  price_numeric: number | null;
  brand: string | null;
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

export interface CartItemWithAlternatives extends Product {
  cart_item_id: number;
  quantity: number;
  alternative_prices: Product[];
}
