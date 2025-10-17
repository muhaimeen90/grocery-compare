"use client";

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import type { CategoryCount } from '@/lib/types';
import { ChevronDown, Filter, X } from 'lucide-react';

interface GlobalFilterSidebarProps {
  store?: string;
  category?: string;
  onStoreChange: (store?: string) => void;
  onCategoryChange: (category?: string) => void;
}

export default function GlobalFilterSidebar({
  store,
  category,
  onStoreChange,
  onCategoryChange,
}: GlobalFilterSidebarProps) {
  const [stores, setStores] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const data = await apiClient.getStores();
        setStores(data);
      } catch (error) {
        console.error('Failed to fetch stores:', error);
      }
    };

    fetchStores();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const data = await apiClient.getCategories(store);
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, [store]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (open && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleStoreSelect = (value: string) => {
    const nextStore = value || undefined;
    onStoreChange(nextStore);
  };

  const handleCategorySelect = (value: string) => {
    const nextCategory = value || undefined;
    onCategoryChange(nextCategory);
  };

  const activeFilters: string[] = [];
  if (store) activeFilters.push(`Store: ${store}`);
  if (category) activeFilters.push(`Category: ${category}`);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="btn-secondary inline-flex items-center gap-2"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Filter className="w-4 h-4" />
        <span>Filters</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {activeFilters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
          {activeFilters.map((filter) => (
            <span key={filter} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
              {filter}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-30 card p-4 shadow-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="store-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Store
              </label>
              <select
                id="store-filter"
                value={store || ''}
                onChange={(e) => handleStoreSelect(e.target.value)}
                className="input"
              >
                <option value="">All stores</option>
                {stores.map((storeName) => (
                  <option key={storeName} value={storeName}>
                    {storeName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              {loadingCategories ? (
                <p className="text-sm text-gray-500">Loading categories...</p>
              ) : (
                <select
                  id="category-filter"
                  value={category || ''}
                  onChange={(e) => handleCategorySelect(e.target.value)}
                  className="input"
                >
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name} ({cat.count})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {(store || category) && (
              <button
                type="button"
                className="btn-link text-sm"
                onClick={() => {
                  onStoreChange(undefined);
                  onCategoryChange(undefined);
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
