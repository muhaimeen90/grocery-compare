"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { apiClient } from '@/lib/api';
import type { CategoryCount } from '@/lib/types';
import { ChevronDown, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalFilterSidebarProps {
  store?: string;
  category?: string;
  onStoreChange: (store?: string) => void;
  onCategoryChange: (category?: string) => void;
}

const STORES = ['IGA', 'Woolworths', 'Coles', 'Aldi'];

const storeAccentClass: Record<string, string> = {
  IGA: 'border-red-200 bg-red-50 text-red-700',
  Woolworths: 'border-green-200 bg-green-50 text-green-700',
  Coles: 'border-red-200 bg-red-50 text-red-800',
  Aldi: 'border-blue-200 bg-blue-50 text-blue-700',
};

export default function GlobalFilterSidebar({
  store,
  category,
  onStoreChange,
  onCategoryChange,
}: GlobalFilterSidebarProps) {
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      try {
        const data = await apiClient.getCategories(store);
        setCategories(data);
      } catch {
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [store]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (open && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const activeCount = [store, category].filter(Boolean).length;

  return (
    <div className="relative flex items-start gap-3" ref={containerRef}>
      {/* Active filter pills */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {store && (
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', storeAccentClass[store] ?? 'border-zinc-200 bg-zinc-50 text-zinc-600')}>
              {store}
              <button type="button" onClick={() => onStoreChange(undefined)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {category && (
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              {category}
              <button type="button" onClick={() => onCategoryChange(undefined)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Filter button */}
      <button
        type="button"
        className={cn(
          'btn-secondary h-9 px-3 text-sm flex-shrink-0',
          activeCount > 0 && 'border-primary-300 text-primary-700 bg-primary-50 hover:bg-primary-50'
        )}
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Filter className="w-3.5 h-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-white text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full mt-2 w-72 z-30 rounded-2xl bg-white border border-zinc-200 shadow-card-hover overflow-hidden"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
              <p className="text-sm font-semibold text-zinc-900">Filters</p>
              <button
                type="button"
                className="btn-ghost h-7 w-7 p-0 text-zinc-400"
                onClick={() => setOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Store */}
              <div>
                <p className="section-label mb-2.5">Store</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {STORES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onStoreChange(store === s ? undefined : s)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-semibold transition-colors text-left',
                        store === s
                          ? (storeAccentClass[s] ?? 'border-primary-300 bg-primary-50 text-primary-700')
                          : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <p className="section-label mb-2.5">Category</p>
                {loadingCategories ? (
                  <div className="space-y-1.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="skeleton h-8 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    <button
                      type="button"
                      onClick={() => onCategoryChange(undefined)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors',
                        !category ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'
                      )}
                    >
                      All categories
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => onCategoryChange(category === cat.name ? undefined : cat.name)}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-xs text-left transition-colors flex items-center justify-between gap-2',
                          category === cat.name
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : 'text-zinc-600 hover:bg-zinc-50'
                        )}
                      >
                        <span className="truncate">{cat.name}</span>
                        <span className="flex-shrink-0 text-zinc-400 text-[11px]">{cat.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Clear */}
              {activeCount > 0 && (
                <button
                  type="button"
                  className="w-full text-center text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors pt-1"
                  onClick={() => {
                    onStoreChange(undefined);
                    onCategoryChange(undefined);
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

