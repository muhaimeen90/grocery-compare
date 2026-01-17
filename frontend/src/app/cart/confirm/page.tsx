'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShoppingBag, Store, AlertTriangle } from 'lucide-react';

import { apiClient } from '@/lib/api';
import type { CompareResponse, SingleStoreOption, TwoStoreOption, ProductMatch } from '@/lib/types';
import { cn, getImageUrl, getOrCreateSessionId, getStoreBadgeClass } from '@/lib/utils';

function getStoreHeaderClass(store: string): string {
  const storeLower = store.toLowerCase();
  if (storeLower === 'iga') return 'bg-red-600 text-white';
  if (storeLower === 'woolworths') return 'bg-green-600 text-white';
  if (storeLower === 'coles') return 'bg-red-700 text-white';
  return 'bg-gray-600 text-white';
}

function ProductMatchCard({ match, showStore }: { match: ProductMatch; showStore?: boolean }) {
  const matched = match.matched_product;
  
  return (
    <div className={cn(
      "card p-4 flex flex-col sm:flex-row gap-4",
      !match.is_available && "opacity-60 bg-gray-50"
    )}>
      {/* Product Image */}
      <div className="relative w-24 h-24 bg-gray-50 rounded flex-shrink-0">
        <Image
          src={getImageUrl(matched?.image_url || match.original_product.image_url)}
          alt={matched?.name || match.original_product.name}
          fill
          className="object-contain p-2"
        />
      </div>
      
      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {showStore && matched && (
              <span className={cn('badge mb-1', getStoreBadgeClass(matched.store))}>{matched.store}</span>
            )}
            <h4 className="font-semibold text-gray-900 text-sm line-clamp-2">
              {matched?.name || match.original_product.name}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              {matched?.brand && <span>Brand: {matched.brand}</span>}
              {matched?.size && <span>Size: {matched.size}</span>}
            </div>
            
            {/* Mismatch Indicators */}
            {match.mismatch_reason && (
              <div className="mt-2 flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded inline-flex">
                <AlertTriangle className="w-3 h-3" />
                <span>{match.mismatch_reason}</span>
              </div>
            )}
            
            {/* Auto-matched indicator */}
            {!match.mismatch_reason && matched && (
              <div className="mt-2 flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded inline-flex">
                <CheckCircle2 className="w-3 h-3" />
                <span>Exact match</span>
              </div>
            )}
            
            {/* Not available indicator */}
            {!match.is_available && (
              <div className="mt-2 flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded inline-flex">
                <AlertCircle className="w-3 h-3" />
                <span>Not available</span>
              </div>
            )}
          </div>
          
          {/* Price */}
          <div className="text-right">
            {matched && match.is_available ? (
              <p className="text-xl font-bold text-gray-900">{matched.price}</p>
            ) : (
              <p className="text-sm font-medium text-gray-500">N/A</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [sessionId, setSessionId] = useState('');

  const fetchComparison = useCallback(async (sid: string, productIds: number[]) => {
    if (!sid || productIds.length === 0) {
      setError('No items selected for comparison.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.compareCart(productIds, sid);
      setComparison(data);
      setError(null);
    } catch (err) {
      console.error('Failed to compare items', err);
      setError('Unable to compare items. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sid = localStorage.getItem('sessionId') || getOrCreateSessionId();
    setSessionId(sid);

    // Get selected items from localStorage
    const stored = localStorage.getItem('selectedCartItems');
    if (!stored) {
      setError('No items selected for comparison. Please go back and add items to cart.');
      setLoading(false);
      return;
    }

    try {
      const productIds: number[] = JSON.parse(stored);
      if (!Array.isArray(productIds) || productIds.length === 0) {
        setError('No items selected for comparison.');
        setLoading(false);
        return;
      }
      fetchComparison(sid, productIds);
    } catch {
      setError('Invalid selection data.');
      setLoading(false);
    }
  }, [fetchComparison]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/cart"
          className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Price Comparison</h1>
          <p className="text-gray-600">See the best deals from a single store or two stores</p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card p-8 flex items-center gap-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Comparing prices across stores…</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="card p-6 flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <Link href="/cart" className="text-sm underline mt-2 inline-block">
              Go back to cart
            </Link>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {!loading && !error && comparison && (
        <div className="space-y-8">
          {/* Best Single Store Option */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-blue-100 p-2 text-blue-600">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Best Single Store</h2>
                <p className="text-gray-600">Shop everything at one location</p>
              </div>
            </div>
            
            <div className="card overflow-hidden">
              <div className={cn('px-6 py-4', getStoreHeaderClass(comparison.best_single_store.store))}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{comparison.best_single_store.store}</h3>
                    <p className="text-sm opacity-90">
                      {comparison.best_single_store.available_count} items available
                      {comparison.best_single_store.missing_count > 0 && 
                        `, ${comparison.best_single_store.missing_count} unavailable`
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">${comparison.best_single_store.total.toFixed(2)}</p>
                    <p className="text-sm opacity-90">Total</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-3">
                {comparison.best_single_store.products.map((match, idx) => (
                  <ProductMatchCard key={idx} match={match} />
                ))}
              </div>
            </div>
          </section>

          {/* Best Two-Store Option */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-purple-100 p-2 text-purple-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Best Two-Store Combination</h2>
                <p className="text-gray-600">Get the lowest prices by shopping at two stores</p>
              </div>
            </div>
            
            <div className="card overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">
                      {comparison.best_two_stores.stores.join(' + ')}
                    </h3>
                    <p className="text-sm opacity-90">
                      {comparison.best_two_stores.available_count} items available
                      {comparison.best_two_stores.missing_count > 0 && 
                        `, ${comparison.best_two_stores.missing_count} unavailable`
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">${comparison.best_two_stores.total.toFixed(2)}</p>
                    <p className="text-sm opacity-90">Total</p>
                    {comparison.best_two_stores.total < comparison.best_single_store.total && (
                      <p className="text-xs mt-1 bg-white/20 px-2 py-0.5 rounded">
                        Save ${(comparison.best_single_store.total - comparison.best_two_stores.total).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-3">
                {comparison.best_two_stores.products.map((match, idx) => (
                  <ProductMatchCard key={idx} match={match} showStore={true} />
                ))}
              </div>
            </div>
          </section>

          {/* Summary */}
          <section className="card p-6 bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-green-600 p-3 text-white">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Summary</h3>
                <div className="space-y-1 text-sm text-gray-700">
                  <p>
                    <strong>Single Store ({comparison.best_single_store.store}):</strong> ${comparison.best_single_store.total.toFixed(2)}
                  </p>
                  <p>
                    <strong>Two Stores ({comparison.best_two_stores.stores.join(' + ')}):</strong> ${comparison.best_two_stores.total.toFixed(2)}
                  </p>
                  {comparison.best_two_stores.total < comparison.best_single_store.total ? (
                    <p className="text-green-700 font-semibold">
                      💰 You save ${(comparison.best_single_store.total - comparison.best_two_stores.total).toFixed(2)} by shopping at two stores!
                    </p>
                  ) : (
                    <p className="text-blue-700 font-semibold">
                      ✨ Shopping at one store is your best value!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            <Link href="/cart" className="btn-secondary">
              Back to Cart
            </Link>
            <Link href="/" className="btn-primary">
              Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
