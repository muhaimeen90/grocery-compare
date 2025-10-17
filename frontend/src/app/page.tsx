'use client';

import { useProducts } from '@/hooks/useProducts';
import SearchBar from '@/components/SearchBar';
import GlobalFilterSidebar from '@/components/GlobalFilterSidebar';
import ProductGrid from '@/components/ProductGrid';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import Pagination from '@/components/Pagination';

export default function Home() {
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
  } = useProducts({ limit: 24, page: 1 });

  const handleStoreChange = (store?: string) => {
    updateFilters({ store, category: undefined, page: 1 });
  };

  const handleCategoryChange = (category?: string) => {
    updateFilters({ category, page: 1 });
  };

  const handleSearch = (search: string) => {
    updateFilters({ search: search || undefined, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    updateFilters({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Discover the best grocery deals today
        </h1>
        <p className="text-gray-600">
          Browsing {total} products across IGA, Woolworths, and Coles. Use the filters to zero in on the
          perfect items for your basket.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="w-full md:max-w-lg">
          <SearchBar
            initialValue={filters.search}
            onSearch={handleSearch}
            placeholder="Search by product name..."
          />
        </div>
        <GlobalFilterSidebar
          store={filters.store}
          category={filters.category}
          onStoreChange={handleStoreChange}
          onCategoryChange={handleCategoryChange}
        />
      </div>

      {/* Products */}
      <div>
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm text-gray-500">
              <span>
                Showing {products.length} of {total} products
              </span>
              {filters.store && (
                <span className="text-gray-600">
                  Store: <strong>{filters.store}</strong>
                </span>
              )}
              {filters.category && (
                <span className="text-gray-600">
                  Category: <strong>{filters.category}</strong>
                </span>
              )}
            </div>

            <ProductGrid products={products} onPriceUpdate={refetch} />

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
  );
}
