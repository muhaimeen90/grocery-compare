'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, X, Clock, ArrowRight, TrendingUp } from 'lucide-react';
import { apiClient } from '@/lib/api';
import type { Product } from '@/lib/types';
import { getImageUrl, cn } from '@/lib/utils';
import Image from 'next/image';
import StoreBadge from '@/components/ui/StoreBadge';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RECENT_KEY = 'gc-recent-searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const current = getRecentSearches().filter((q) => q !== query);
  const updated = [query, ...current].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

const POPULAR = ['Milk', 'Bread', 'Eggs', 'Butter', 'Yoghurt', 'Chicken', 'Coffee'];

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setActiveIdx(-1);
    }
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiClient.getProducts({ search: q, limit: 6 });
      setResults(data.products);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const handleSubmit = (q: string = query) => {
    if (!q.trim()) return;
    addRecentSearch(q.trim());
    router.push(`/?search=${encodeURIComponent(q.trim())}`);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = results.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) {
        handleSubmit(results[activeIdx].name);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed top-[12vh] left-1/2 z-50 w-full max-w-xl -translate-x-1/2 px-4"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="overflow-hidden rounded-2xl bg-white shadow-modal border border-zinc-200">
              {/* Input row */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-100">
                <Search className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search groceries…"
                  className="flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="text-zinc-400 hover:text-zinc-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-zinc-200 px-1.5 text-xs font-mono text-zinc-500">Esc</kbd>
              </div>

              {/* Results */}
              <div className="max-h-[56vh] overflow-y-auto">
                {loading && (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg py-2 px-2 animate-pulse">
                        <div className="skeleton h-10 w-10 rounded-md flex-shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="skeleton h-3.5 w-3/4" />
                          <div className="skeleton h-3 w-1/3" />
                        </div>
                        <div className="skeleton h-5 w-12" />
                      </div>
                    ))}
                  </div>
                )}

                {!loading && query && results.length > 0 && (
                  <div className="p-2">
                    {results.map((product, i) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSubmit(product.name)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors',
                          i === activeIdx ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                        )}
                      >
                        <div className="relative h-10 w-10 flex-shrink-0 rounded-md overflow-hidden bg-zinc-100">
                          <Image
                            src={getImageUrl(product.image_url)}
                            alt={product.name}
                            fill
                            className="object-contain p-1"
                            sizes="40px"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{product.name}</p>
                          <p className="text-xs text-zinc-500 truncate">{product.brand || product.category}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StoreBadge store={product.store} />
                          <span className="text-sm font-semibold text-zinc-900">{product.price}</span>
                        </div>
                      </button>
                    ))}

                    {query && (
                      <button
                        type="button"
                        onClick={() => handleSubmit()}
                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-primary-600 font-medium hover:bg-primary-50 transition-colors mt-1"
                      >
                        <Search className="w-4 h-4" />
                        Search for &ldquo;{query}&rdquo;
                        <ArrowRight className="w-4 h-4 ml-auto" />
                      </button>
                    )}
                  </div>
                )}

                {!loading && query && results.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-zinc-500">No results for <strong>&ldquo;{query}&rdquo;</strong></p>
                    <button
                      type="button"
                      onClick={() => handleSubmit()}
                      className="mt-3 text-sm text-primary-600 font-medium hover:underline"
                    >
                      Search anyway →
                    </button>
                  </div>
                )}

                {!query && (
                  <div className="p-3 space-y-4">
                    {recentSearches.length > 0 && (
                      <div>
                        <p className="px-2 mb-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-400">Recent</p>
                        {recentSearches.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => handleSubmit(term)}
                            className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
                          >
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            {term}
                          </button>
                        ))}
                      </div>
                    )}

                    <div>
                      <p className="px-2 mb-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-400">Popular</p>
                      <div className="flex flex-wrap gap-2 px-2">
                        {POPULAR.map((term) => (
                          <button
                            key={term}
                            type="button"
                            onClick={() => handleSubmit(term)}
                            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 transition-colors"
                          >
                            <TrendingUp className="w-3 h-3 text-zinc-400" />
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
