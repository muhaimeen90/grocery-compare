'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import type { ProductList, FilterOptions } from '@/lib/types';

export function useProducts(initialFilters: FilterOptions = {}) {
  const [data, setData] = useState<ProductList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>(initialFilters);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.getProducts(filters);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const updateFilters = (newFilters: Partial<FilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  return {
    products: data?.products || [],
    total: data?.total || 0,
    page: data?.page || 1,
    pages: data?.pages || 0,
    loading,
    error,
    filters,
    updateFilters,
    resetFilters,
    refetch: fetchProducts,
  };
}
