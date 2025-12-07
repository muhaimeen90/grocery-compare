'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShoppingBag, Star, XCircle, AlertTriangle } from 'lucide-react';

import { apiClient } from '@/lib/api';
import type { CompareResponse, StoreComparison, BestDealItem, ProductMatch } from '@/lib/types';
import { cn, getImageUrl, getOrCreateSessionId, getStoreBadgeClass } from '@/lib/utils';

const STORES = ['IGA', 'Woolworths', 'Coles'];

// Types for stored approval data
type ApprovedAlternatives = Record<number, Record<string, number>>;
type DiscardedAlternatives = Record<number, number[]>;

function getStoreCardClass(store: string): string {
  const storeLower = store.toLowerCase();
  if (storeLower === 'iga') return 'border-red-200 bg-red-50/30';
  if (storeLower === 'woolworths') return 'border-green-200 bg-green-50/30';
  if (storeLower === 'coles') return 'border-red-200 bg-red-50/30';
  return 'border-gray-200 bg-gray-50/30';
}

function getStoreHeaderClass(store: string): string {
  const storeLower = store.toLowerCase();
  if (storeLower === 'iga') return 'bg-red-600 text-white';
  if (storeLower === 'woolworths') return 'bg-green-600 text-white';
  if (storeLower === 'coles') return 'bg-red-700 text-white';
  return 'bg-gray-600 text-white';
}

export default function ConfirmPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [filteredComparison, setFilteredComparison] = useState<CompareResponse | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [approvedAlts, setApprovedAlts] = useState<ApprovedAlternatives>({});
  const [discardedAlts, setDiscardedAlts] = useState<DiscardedAlternatives>({});

  // Filter comparison data based on approved/discarded alternatives
  const filterComparison = useCallback((data: CompareResponse): CompareResponse => {
    // Filter store comparisons
    const filteredStoreComparisons: StoreComparison[] = data.store_comparisons.map((sc) => {
      const filteredProducts: ProductMatch[] = sc.products.map((pm) => {
        if (!pm.matched_product) return pm;
        
        const originalId = pm.original_product.id;
        const matchedId = pm.matched_product.id;
        const store = sc.store;
        
        // Check if this match is discarded
        const isDiscarded = discardedAlts[originalId]?.includes(matchedId);
        
        // Check if this match needs approval but wasn't approved
        const needsApproval = pm.needs_approval === true;
        const isApproved = approvedAlts[originalId]?.[store] === matchedId;
        
        // If discarded, or needs approval but not approved, mark as unavailable
        if (isDiscarded || (needsApproval && !isApproved)) {
          return {
            ...pm,
            matched_product: null,
            is_available: false,
          };
        }
        
        return pm;
      });
      
      // Recalculate totals
      let total = 0;
      let availableCount = 0;
      let missingCount = 0;
      
      for (const pm of filteredProducts) {
        if (pm.is_available && pm.matched_product) {
          total += pm.matched_product.price_numeric || 0;
          availableCount++;
        } else {
          missingCount++;
        }
      }
      
      return {
        ...sc,
        products: filteredProducts,
        total: Math.round(total * 100) / 100,
        available_count: availableCount,
        missing_count: missingCount,
      };
    });
    
    // Recalculate best deal based on filtered data
    const bestDeal: BestDealItem[] = [];
    let bestDealTotal = 0;
    let originalTotal = 0;
    
    // Group products by original product ID to find best price across stores
    const productBestPrices: Map<number, { bestItem: BestDealItem | null; originalPrice: number }> = new Map();
    
    // Initialize with original products
    for (const sc of filteredStoreComparisons) {
      for (const pm of sc.products) {
        const originalId = pm.original_product.id;
        if (!productBestPrices.has(originalId)) {
          productBestPrices.set(originalId, {
            bestItem: null,
            originalPrice: pm.original_product.price_numeric || 0,
          });
        }
        
        if (pm.is_available && pm.matched_product) {
          const price = pm.matched_product.price_numeric || 0;
          const existing = productBestPrices.get(originalId)!;
          
          if (!existing.bestItem || price < existing.bestItem.price) {
            productBestPrices.set(originalId, {
              ...existing,
              bestItem: {
                original_product: pm.original_product,
                best_product: pm.matched_product,
                store: sc.store,
                price: price,
                savings: Math.max(0, existing.originalPrice - price),
              },
            });
          }
        }
      }
    }
    
    // Build best deal list
    for (const [, value] of productBestPrices) {
      originalTotal += value.originalPrice;
      if (value.bestItem) {
        bestDeal.push(value.bestItem);
        bestDealTotal += value.bestItem.price;
      }
    }
    
    return {
      store_comparisons: filteredStoreComparisons,
      best_deal: bestDeal,
      best_deal_total: Math.round(bestDealTotal * 100) / 100,
      best_deal_savings: Math.round(Math.max(0, originalTotal - bestDealTotal) * 100) / 100,
    };
  }, [approvedAlts, discardedAlts]);

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

  // Apply filtering whenever comparison data or approval state changes
  useEffect(() => {
    if (comparison) {
      const filtered = filterComparison(comparison);
      setFilteredComparison(filtered);
    }
  }, [comparison, filterComparison]);

  useEffect(() => {
    const sid = getOrCreateSessionId();
    setSessionId(sid);

    // Get selected items from localStorage
    const stored = localStorage.getItem('selectedCartItems');
    if (!stored) {
      setError('No items selected for comparison. Please go back and select items.');
      setLoading(false);
      return;
    }

    // Get approved alternatives from localStorage
    const approvedStored = localStorage.getItem('approvedAlternatives');
    if (approvedStored) {
      try {
        setApprovedAlts(JSON.parse(approvedStored));
      } catch {
        console.error('Failed to parse approved alternatives');
      }
    }

    // Get discarded alternatives from localStorage
    const discardedStored = localStorage.getItem('discardedAlternatives');
    if (discardedStored) {
      try {
        setDiscardedAlts(JSON.parse(discardedStored));
      } catch {
        console.error('Failed to parse discarded alternatives');
      }
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

  // Find the store with lowest total (with all items available)
  const getLowestTotalStore = (): string | null => {
    if (!filteredComparison) return null;
    let lowestStore: string | null = null;
    let lowestTotal = Infinity;
    
    for (const sc of filteredComparison.store_comparisons) {
      if (sc.missing_count === 0 && sc.total < lowestTotal) {
        lowestTotal = sc.total;
        lowestStore = sc.store;
      }
    }
    return lowestStore;
  };

  const lowestTotalStore = getLowestTotalStore();

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
        <div className="rounded-full bg-primary-50 p-3 text-primary-600">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Price Comparison</h1>
          <p className="text-gray-600">Compare your selected items across all stores.</p>
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
        <div className="card p-6 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div>
            <p className="font-medium text-red-700">{error}</p>
            <Link href="/cart" className="text-sm text-primary-600 hover:underline mt-2 inline-block">
              Back to cart
            </Link>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {!loading && !error && filteredComparison && (
        <div className="space-y-8">
          {/* Store Comparison Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {STORES.map((store) => {
              const storeData = filteredComparison.store_comparisons.find((sc) => sc.store === store);
              if (!storeData) return null;

              const isLowest = lowestTotalStore === store;

              return (
                <div
                  key={store}
                  className={cn(
                    'rounded-xl border-2 overflow-hidden transition-all',
                    getStoreCardClass(store),
                    isLowest && 'ring-2 ring-yellow-400 ring-offset-2'
                  )}
                >
                  {/* Store Header */}
                  <div className={cn('px-4 py-3 flex items-center justify-between', getStoreHeaderClass(store))}>
                    <h2 className="text-lg font-bold">{store}</h2>
                    {isLowest && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">
                        <Star className="w-3 h-3" /> Best Store Price
                      </span>
                    )}
                  </div>

                  {/* Products List */}
                  <div className="divide-y divide-gray-200">
                    {storeData.products.map((pm, idx) => (
                      <div key={idx} className="p-4 flex items-center gap-4">
                        {pm.is_available && pm.matched_product ? (
                          <>
                            <div className="relative w-16 h-16 flex-shrink-0 bg-white rounded-lg overflow-hidden">
                              <Image
                                src={getImageUrl(pm.matched_product.image_url)}
                                alt={pm.matched_product.name}
                                fill
                                className="object-contain p-1"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              {pm.matched_product.product_url ? (
                                <a
                                  href={pm.matched_product.product_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-gray-900 truncate block hover:text-primary-600 hover:underline transition-colors"
                                  title={`View ${pm.matched_product.name} on ${store}`}
                                >
                                  {pm.matched_product.name}
                                </a>
                              ) : (
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {pm.matched_product.name}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 truncate">
                                {pm.matched_product.brand || 'Unbranded'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">
                                {pm.matched_product.price}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg flex items-center justify-center">
                              <XCircle className="w-8 h-8 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-500 truncate">
                                {pm.original_product.name}
                              </p>
                              <p className="text-xs text-red-500">
                                Not available in this store
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-400">—</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Store Total */}
                  <div className="px-4 py-4 bg-white/50 border-t-2 border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">
                          {storeData.available_count} of {storeData.products.length} items available
                        </p>
                        {storeData.missing_count > 0 && (
                          <p className="text-xs text-red-500">
                            {storeData.missing_count} item(s) not found
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase">Total</p>
                        <p className="text-2xl font-bold text-gray-900">
                          ${storeData.total.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Best Deal Section */}
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 px-6 py-4">
              <div className="flex items-center gap-3">
                <Star className="w-8 h-8 text-yellow-900" />
                <div>
                  <h2 className="text-xl font-bold text-yellow-900">Best Deal Combination</h2>
                  <p className="text-sm text-yellow-800">
                    Get the lowest price for each item across all stores
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Warning if some products couldn't be matched */}
              {filteredComparison.best_deal.length < filteredComparison.store_comparisons[0]?.products.length && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Some products couldn&apos;t be matched</p>
                    <p className="mt-1">
                      {filteredComparison.store_comparisons[0]?.products.length - filteredComparison.best_deal.length} product(s) 
                      had no approved matches and are excluded from the best deal calculation.
                    </p>
                  </div>
                </div>
              )}

              {/* Best Deal Items */}
              <div className="divide-y divide-gray-100">
                {filteredComparison.best_deal.map((item, idx) => (
                  <div key={idx} className="py-4 flex items-center gap-4">
                    <div className="relative w-16 h-16 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden">
                      <Image
                        src={getImageUrl(item.best_product.image_url)}
                        alt={item.best_product.name}
                        fill
                        className="object-contain p-1"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.best_product.product_url ? (
                        <a
                          href={item.best_product.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-900 truncate block hover:text-primary-600 hover:underline transition-colors"
                          title={`View ${item.best_product.name} on ${item.store}`}
                        >
                          {item.best_product.name}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.best_product.name}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 truncate">
                        {item.best_product.brand || 'Unbranded'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('badge', getStoreBadgeClass(item.store))}>
                        {item.store}
                      </span>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          ${item.price.toFixed(2)}
                        </p>
                        {item.savings > 0 && (
                          <p className="text-xs text-green-600 font-medium">
                            Save ${item.savings.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Best Deal Summary */}
              <div className="mt-6 pt-6 border-t-2 border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-6 h-6" />
                    <div>
                      <p className="font-semibold">Total Savings</p>
                      <p className="text-2xl font-bold">${filteredComparison.best_deal_savings.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 uppercase">Best Deal Total</p>
                    <p className="text-3xl font-bold text-gray-900">
                      ${filteredComparison.best_deal_total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Back to Cart */}
          <div className="flex justify-center">
            <Link
              href="/cart"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to cart
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
