'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useProducts } from '@/hooks/useProducts';
import ProductGrid from '@/components/ProductGrid';
import SearchBar from '@/components/SearchBar';
import FilterSidebar from '@/components/FilterSidebar';
import Pagination from '@/components/Pagination';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function CategoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const store = params.store as string;
  const category = decodeURIComponent(params.category as string);
  const isAll = category === 'all';

  const initialFilters = {
    store,
    ...(isAll ? {} : { category }),
    search: searchParams.get('search') || undefined,
    sort: (searchParams.get('sort') as 'name' | 'price_low' | 'price_high') || 'name',
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

  const updateQueryParams = (nextSearch?: string, nextSort: 'name' | 'price_low' | 'price_high' = 'name') => {
    const p = new URLSearchParams();
    if (nextSearch) p.set('search', nextSearch);
    if (nextSort && nextSort !== 'name') p.set('sort', nextSort);
    router.push(p.toString() ? `?${p.toString()}` : '?', { scroll: false });
  };

  const handleSearch = (search: string) => {
    const value = search || undefined;
    updateFilters({ search: value, page: 1 });
    updateQueryParams(value, (filters.sort as 'name' | 'price_low' | 'price_high') || 'name');
  };

  const handleSortChange = (sort: 'name' | 'price_low' | 'price_high') => {
    updateFilters({ sort, page: 1 });
    updateQueryParams(filters.search, sort);
  };

  const handlePageChange = (newPage: number) => {
    updateFilters({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-zinc-500 mb-5">
        <Link href="/" className="hover:text-zinc-700 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
        <Link href={`/store/${store}`} className="hover:text-zinc-700 transition-colors">{store}</Link>
        {!isAll && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
            <span className="text-zinc-900 font-medium">{category}</span>
          </>
        )}
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-1">
          {isAll ? `All ${store} products` : category}
        </h1>
        <p className="text-sm text-zinc-500">
          {loading ? 'Loading…' : `${total.toLocaleString()} product${total !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchBar
          initialValue={filters.search}
          onSearch={handleSearch}
          placeholder={`Search in ${isAll ? store : category}…`}
          className="max-w-md"
        />
      </div>

      {/* Content layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-52 flex-shrink-0">
          <FilterSidebar
            currentSort={(filters.sort as 'name' | 'price_low' | 'price_high') || 'name'}
            onSortChange={handleSortChange}
          />
        </aside>

        {/* Products */}
        <div className="flex-1 min-w-0">
          {loading && <LoadingSkeleton />}

          {error && (
            <div className="card p-8 text-center">
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button onClick={refetch} className="btn-primary">Try again</button>
            </div>
          )}

          {!loading && !error && (
            <>
              <ProductGrid products={products} onPriceUpdate={updateProduct} />
              {pages > 1 && (
                <div className="mt-10 flex justify-center">
                  <Pagination currentPage={page} totalPages={pages} onPageChange={handlePageChange} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

