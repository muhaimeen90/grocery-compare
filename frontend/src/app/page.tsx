'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useProducts } from '@/hooks/useProducts';
import ProductGrid from '@/components/ProductGrid';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import Pagination from '@/components/Pagination';
import { apiClient } from '@/lib/api';
import { Search, ChevronDown, X } from 'lucide-react';
import Image from 'next/image';
import HeroWave from '@/components/HeroWave';

// ─── Store config ──────────────────────────────────────────────────
const STORES = [
  { name: 'IGA',         logo: '/assets/logos/iga.png' },
  { name: 'Woolworths',  logo: '/assets/logos/woolworths.png' },
  { name: 'Coles',       logo: '/assets/logos/coles.png' },
  { name: 'Aldi',        logo: '/assets/logos/aldi.png' },
];

const SORT_OPTIONS: { value: '' | 'name' | 'price_low' | 'price_high'; label: string }[] = [
  { value: 'price_low',  label: 'Sort by Lowest Price' },
  { value: 'price_high', label: 'Sort by Highest Price' },
  { value: 'name',       label: 'Sort by Name (A–Z)' },
];

// ─── Store card ────────────────────────────────────────────────────
function StoreCard({
  store,
  isActive,
  onClick,
}: {
  store: typeof STORES[0];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -4, boxShadow: '0 12px 28px rgba(0,0,0,0.15)' }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      onClick={onClick}
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-xl bg-white px-5 py-5 shadow-md border-2 transition-all cursor-pointer',
        isActive
          ? 'border-white ring-4 ring-white/40 shadow-lg'
          : 'border-transparent hover:border-white/60',
      ].join(' ')}
    >
      <div className="relative h-11 w-24">
        <Image src={store.logo} alt={store.name} fill unoptimized className="object-contain" sizes="96px" />
      </div>
      <span className="text-sm font-semibold text-[#1f2933]">{store.name}</span>
    </motion.button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────
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
    updateProduct,
  } = useProducts({ limit: 24, page: 1 });

  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [brands,     setBrands]     = useState<string[]>([]);

  // Local controlled search inputs
  const [searchInput,   setSearchInput]   = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [brandInput,    setBrandInput]    = useState('');
  const [sortInput, setSortInput] = useState<'' | 'name' | 'price_low' | 'price_high'>('price_low');

  useEffect(() => {
    apiClient.getCategories().then((cats) => setCategories(cats)).catch(() => {});
    apiClient.getBrands().then((b) => setBrands(b.slice(0, 80))).catch(() => {});
  }, []);

  const applySearch = () => {
    updateFilters({
      search:   searchInput   || undefined,
      category: categoryInput || undefined,
      brand:    brandInput    || undefined,
      sort:     sortInput     || undefined,
      page: 1,
    });
    document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStoreSelect = (storeName: string) => {
    const isActive = filters.store === storeName;
    updateFilters({ store: isActive ? undefined : storeName, page: 1 });
    document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearAllFilters = () => {
    updateFilters({ store: undefined, category: undefined, search: undefined, brand: undefined, sort: undefined, page: 1 });
    setSearchInput('');
    setCategoryInput('');
    setBrandInput('');
    setSortInput('price_low');
  };

  const handlePageChange = (newPage: number) => {
    updateFilters({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = !!(filters.store || filters.category || filters.search || filters.brand);

  return (
    <div className="min-h-screen bg-[#f8faf7]">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)' }}
      >
        {/* Interactive water ripple background */}
        <HeroWave />

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">

          {/* Headline */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <h1 className="font-display text-4xl sm:text-5xl md:text-[3.75rem] font-normal text-white leading-tight tracking-tight mb-4">
              Compare grocery prices
              <br />
              <span className="text-white/90">Instantly.</span>
            </h1>
           
          </motion.div>

          {/* Store selector cards */}
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            {STORES.map((store) => (
              <StoreCard
                key={store.name}
                store={store}
                isActive={filters.store === store.name}
                onClick={() => handleStoreSelect(store.name)}
              />
            ))}
          </motion.div>

          {/* Search / filter bar */}
          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <div className="bg-white rounded-xl shadow-md flex flex-wrap items-center gap-0 overflow-hidden">
              {/* Search input */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                  placeholder="Search for products..."
                  className="w-full pl-10 pr-3 py-3.5 text-sm text-[#1f2933] placeholder:text-gray-400 bg-transparent focus:outline-none"
                />
              </div>

              <div className="self-stretch w-px bg-[#e5e7eb]" />

              {/* Category dropdown */}
              <div className="relative">
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="appearance-none bg-transparent pl-4 pr-8 py-3.5 text-sm text-[#4b5563] focus:outline-none cursor-pointer whitespace-nowrap"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>

              <div className="self-stretch w-px bg-[#e5e7eb]" />

              {/* Brand dropdown */}
              <div className="relative">
                <select
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  className="appearance-none bg-transparent pl-4 pr-8 py-3.5 text-sm text-[#4b5563] focus:outline-none cursor-pointer whitespace-nowrap"
                >
                  <option value="">All Brands</option>
                  {brands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>

              <div className="self-stretch w-px bg-[#e5e7eb]" />

              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={sortInput}
                  onChange={(e) => setSortInput(e.target.value as '' | 'name' | 'price_low' | 'price_high')}
                  className="appearance-none bg-transparent pl-4 pr-8 py-3.5 text-sm text-[#4b5563] focus:outline-none cursor-pointer whitespace-nowrap"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>

              {/* Search button */}
              <button
                onClick={applySearch}
                className="flex-shrink-0 bg-[#22c55e] hover:bg-[#16a34a] active:bg-[#15803d] text-white font-semibold px-7 py-3.5 text-sm transition-colors"
              >
                Search
              </button>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── Products ──────────────────────────────────────────────── */}
      <section id="products-section" className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Section header */}
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-flex items-center rounded-full bg-[#22c55e] px-4 py-1.5 text-sm font-semibold text-white shadow-sm">
            Products
          </span>
          {!loading && (
            <span className="text-sm text-[#4b5563]">
              {total.toLocaleString()} {hasActiveFilters ? 'results' : 'products'}
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-[#4b5563] hover:text-[#1f2933] border border-[#e5e7eb] rounded-lg px-3 py-1.5 hover:bg-white transition-all"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-6">
            {filters.store && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-xs font-medium text-[#1f2933] shadow-sm">
                Store: {filters.store}
                <button onClick={() => updateFilters({ store: undefined, page: 1 })} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.search && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-xs font-medium text-[#1f2933] shadow-sm">
                &ldquo;{filters.search}&rdquo;
                <button onClick={() => { updateFilters({ search: undefined, page: 1 }); setSearchInput(''); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.category && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-xs font-medium text-[#1f2933] shadow-sm">
                {filters.category}
                <button onClick={() => { updateFilters({ category: undefined, page: 1 }); setCategoryInput(''); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.brand && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-xs font-medium text-[#1f2933] shadow-sm">
                {filters.brand}
                <button onClick={() => { updateFilters({ brand: undefined, page: 1 }); setBrandInput(''); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Loading / Error / Products */}
        {loading && <LoadingSkeleton />}

        {error && (
          <div className="rounded-xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={refetch}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <ProductGrid products={products} onPriceUpdate={updateProduct} />

            {pages > 1 && (
              <div className="mt-10 flex justify-center">
                <Pagination
                  currentPage={page}
                  totalPages={pages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

