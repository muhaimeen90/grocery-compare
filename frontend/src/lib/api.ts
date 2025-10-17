import axios from 'axios';
import type { Product, ProductList, CategoryCount, ScrapeStatus, FilterOptions } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = {
  // Products
  async getProducts(filters: FilterOptions = {}): Promise<ProductList> {
    const params = new URLSearchParams();
    
    if (filters.store) params.append('store', filters.store);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.brand) params.append('brand', filters.brand);
    if (filters.sort) params.append('sort', filters.sort);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    
    const { data } = await api.get<ProductList>('/api/products', { params });
    return data;
  },

  async getProduct(id: number): Promise<Product> {
    const { data } = await api.get<Product>(`/api/products/${id}`);
    return data;
  },

  async getStores(): Promise<string[]> {
    const { data } = await api.get<string[]>('/api/products/stores/list');
    return data;
  },

  async getCategories(store?: string): Promise<CategoryCount[]> {
    const params = store ? { store } : {};
    const { data } = await api.get<CategoryCount[]>('/api/products/categories/list', { params });
    return data;
  },

  async getBrands(store?: string, category?: string): Promise<string[]> {
    const params: any = {};
    if (store) params.store = store;
    if (category) params.category = category;
    const { data } = await api.get<string[]>('/api/products/brands/list', { params });
    return data;
  },

  // Scraping
  async scrapePrice(productId: number): Promise<{ task_id: string; status: string }> {
    const { data } = await api.post('/api/scrape', { product_id: productId });
    return data;
  },

  async getScrapeStatus(taskId: string): Promise<ScrapeStatus> {
    const { data } = await api.get<ScrapeStatus>(`/api/scrape/${taskId}`);
    return data;
  },

  async scrapeBatch(productIds: number[]): Promise<{ task_id: string; status: string; total: number }> {
    const { data } = await api.post('/api/scrape/batch', { product_ids: productIds });
    return data;
  },
};

export default api;
