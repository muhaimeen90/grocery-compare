'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useProducts } from '@/hooks/useProducts';
import ProductGrid from '@/components/ProductGrid';
import SearchBar from '@/components/SearchBar';
import FilterSidebar from '@/components/FilterSidebar';
import Pagination from '@/components/Pagination';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { useState } from 'react';
import { Filter } from 'lucide-react';

export default function CategoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const store = params.store as string;
  const category = decodeURIComponent(params.category as string);
  
  const [showFilters, setShowFilters] = useState(false);
  
  const initialFilters = {
    store,
    category,
    search: searchParams.get('search') || undefined,
    sort: (searchParams.get('sort') as any) || 'name',
    page: parseInt(searchParams.get('page') || '1'),
    limit: 30,
  };

  const {
    products,
    total,
    page,
    pages,
    loading,
    error,
    filters,
    updateFilters,
    refetch,
    updateProduct,
  } = useProducts(initialFilters);

  const updateQueryParams = (
    nextSearch?: string,
    nextSort: 'name' | 'price_low' | 'price_high' = 'name'
  ) => {
    const params = new URLSearchParams();
    if (nextSearch) params.set('search', nextSearch);
    if (nextSort && nextSort !== 'name') params.set('sort', nextSort);
    const queryString = params.toString();
    router.push(queryString ? `?${queryString}` : '?', { scroll: false });
  };

  const handleSearch = (search: string) => {
    const value = search || undefined;
    updateFilters({ search: value, page: 1 });
    updateQueryParams(value, (filters.sort as 'name' | 'price_low' | 'price_high') || 'name');
  };

  const handleSortChange = (sort: 'name' | 'price_low' | 'price_high') => {
    const nextSort = sort || 'name';
    updateFilters({ sort: nextSort, page: 1 });
    updateQueryParams(filters.search, nextSort);
  };

  const handlePageChange = (newPage: number) => {
    updateFilters({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center text-sm text-gray-500 mb-2">
          <span>{store}</span>
          <span className="mx-2">/</span>
          <span className="text-gray-900">{category}</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{category}</h1>
        <p className="text-gray-600 mt-1">
          {total} {total === 1 ? 'product' : 'products'} found
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchBar
          initialValue={filters.search}
          onSearch={handleSearch}
        />
      </div>

      {/* Mobile Filter Toggle */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn-secondary w-full flex items-center justify-center"
        >
          <Filter className="w-4 h-4 mr-2" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className={`lg:w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
          <FilterSidebar
            currentSort={(filters.sort as 'name' | 'price_low' | 'price_high') || 'name'}
            onSortChange={handleSortChange}
          />
        </aside>

        {/* Products */}
        <div className="flex-1">
          {loading && <LoadingSkeleton />}
          
          {error && (
            <div className="card p-6 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button onClick={refetch} className="btn-primary">
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <ProductGrid products={products} onPriceUpdate={updateProduct} />
              
              {pages > 1 && (
                <div className="mt-8">
                  <Pagination
                    currentPage={page}
                    totalPages={pages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
