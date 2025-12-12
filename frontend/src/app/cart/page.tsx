'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, CheckCircle, CheckSquare, Loader2, ShoppingBag, Square, Trash2, XCircle } from 'lucide-react';

import { apiClient } from '@/lib/api';
import type { CartItemWithAlternatives, ProductWithApproval } from '@/lib/types';
import { cn, formatDate, getImageUrl, getOrCreateSessionId, getStoreBadgeClass } from '@/lib/utils';

// Track approved alternatives: { originalProductId: { store: alternativeProductId } }
type ApprovedAlternatives = Record<number, Record<string, number>>;
// Track discarded alternatives: { originalProductId: Set<alternativeProductId> }
type DiscardedAlternatives = Record<number, Set<number>>;

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItemWithAlternatives[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [approvedAlts, setApprovedAlts] = useState<ApprovedAlternatives>({});
  const [discardedAlts, setDiscardedAlts] = useState<DiscardedAlternatives>({});

  const fetchCart = useCallback(async (id: string) => {
    if (!id) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.getCart(id);
      setItems(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load cart', err);
      setError('Unable to load your cart right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = getOrCreateSessionId();
    setSessionId(id);
    fetchCart(id);
  }, [fetchCart]);

  const handleRemove = async (productId: number) => {
    if (!sessionId) return;
    setRemovingId(productId);
    try {
      await apiClient.removeFromCart(productId, sessionId);
      await fetchCart(sessionId);
    } catch (err) {
      console.error('Failed to remove item', err);
      setError('Unable to remove the item. Please try again.');
    } finally {
      setRemovingId(null);
    }
  };

  const hasItems = items.length > 0;

  const toggleSelection = (productId: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item) => item.id)));
    }
  };

  const handleApproveAlt = (originalProductId: number, alt: ProductWithApproval) => {
    // Find all alternatives for this product from the same store
    const item = items.find(i => i.id === originalProductId);
    const otherAltsFromSameStore = item?.alternative_prices.filter(
      a => a.store === alt.store && a.id !== alt.id
    ) || [];

    // Approve this alternative
    setApprovedAlts((prev) => ({
      ...prev,
      [originalProductId]: {
        ...prev[originalProductId],
        [alt.store]: alt.id,
      },
    }));
    
    // Remove from discarded if it was there
    setDiscardedAlts((prev) => {
      const next = { ...prev };
      if (next[originalProductId]) {
        const newSet = new Set(next[originalProductId]);
        newSet.delete(alt.id);
        next[originalProductId] = newSet;
      }
      return next;
    });

    // Automatically discard other alternatives from the same store
    if (otherAltsFromSameStore.length > 0) {
      setDiscardedAlts((prev) => {
        const next = { ...prev };
        if (!next[originalProductId]) {
          next[originalProductId] = new Set();
        }
        const newSet = new Set(next[originalProductId]);
        otherAltsFromSameStore.forEach(a => newSet.add(a.id));
        next[originalProductId] = newSet;
        return next;
      });
    }
  };

  const handleDiscardAlt = (originalProductId: number, alt: ProductWithApproval) => {
    setDiscardedAlts((prev) => {
      const next = { ...prev };
      if (!next[originalProductId]) {
        next[originalProductId] = new Set();
      }
      next[originalProductId] = new Set(next[originalProductId]).add(alt.id);
      return next;
    });
    // Remove from approved if it was there
    setApprovedAlts((prev) => {
      const next = { ...prev };
      if (next[originalProductId] && next[originalProductId][alt.store] === alt.id) {
        const { [alt.store]: _, ...rest } = next[originalProductId];
        next[originalProductId] = rest;
      }
      return next;
    });
  };

  const isAltApproved = (originalProductId: number, alt: ProductWithApproval): boolean => {
    return approvedAlts[originalProductId]?.[alt.store] === alt.id;
  };

  const isAltDiscarded = (originalProductId: number, altId: number): boolean => {
    return discardedAlts[originalProductId]?.has(altId) ?? false;
  };

  const handleConfirm = () => {
    if (selectedItems.size === 0) return;
    // Store selected IDs in localStorage for the confirm page
    localStorage.setItem('selectedCartItems', JSON.stringify(Array.from(selectedItems)));
    // Store approved alternatives (convert Sets aren't serializable, so we store as arrays)
    localStorage.setItem('approvedAlternatives', JSON.stringify(approvedAlts));
    // Store discarded alternatives (convert Set to array for each product)
    const discardedForStorage: Record<number, number[]> = {};
    for (const [productId, discardedSet] of Object.entries(discardedAlts)) {
      discardedForStorage[Number(productId)] = Array.from(discardedSet);
    }
    localStorage.setItem('discardedAlternatives', JSON.stringify(discardedForStorage));
    router.push('/cart/confirm');
  };

  const allSelected = items.length > 0 && selectedItems.size === items.length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="rounded-full bg-primary-50 p-3 text-primary-600">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Cart</h1>
          <p className="text-gray-600">Review items and compare their prices across other stores.</p>
        </div>
      </div>

      {loading && (
        <div className="card p-8 flex items-center gap-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading your cart…</span>
        </div>
      )}

      {!loading && error && (
        <div className="card p-6 flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">{error}</p>
            <button onClick={() => fetchCart(sessionId)} className="text-sm underline">
              Try again
            </button>
          </div>
        </div>
      )}

      {!loading && !error && !hasItems && (
        <div className="card p-10 text-center space-y-4">
          <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Your cart is empty</h2>
          <p className="text-gray-600">Browse products and add them to your cart to compare prices.</p>
          <div className="flex justify-center gap-3">
            <Link href="/" className="btn-primary">
              Start shopping
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && hasItems && (
        <div className="space-y-6">
          {/* Selection Controls */}
          <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {allSelected ? (
                <CheckSquare className="w-5 h-5 text-primary-600" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              {allSelected ? 'Deselect all' : 'Select all'}
              <span className="text-gray-500">({selectedItems.size}/{items.length} selected)</span>
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedItems.size === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 mr-2" />
              Compare Selected ({selectedItems.size})
            </button>
          </div>

          {items.map((item) => (
            <div 
              key={item.cart_item_id} 
              className={cn(
                "card overflow-hidden transition-all relative",
                selectedItems.has(item.id) && "ring-2 ring-primary-500"
              )}
            >
              <div className="flex flex-col md:flex-row">
                {/* Selection checkbox */}
                <button
                  type="button"
                  onClick={() => toggleSelection(item.id)}
                  className="absolute top-4 right-4 z-10 md:relative md:top-0 md:right-0 md:flex md:items-center md:justify-center md:w-12 md:bg-gray-50 md:border-r"
                >
                  {selectedItems.has(item.id) ? (
                    <CheckSquare className="w-6 h-6 text-primary-600" />
                  ) : (
                    <Square className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                  )}
                </button>

                <div className="relative md:w-1/3 bg-gray-50 aspect-square">
                  <Image
                    src={getImageUrl(item.image_url)}
                    alt={item.name}
                    fill
                    className="object-contain p-6"
                  />
                  <div className="absolute top-3 left-3">
                    <span className={cn('badge', getStoreBadgeClass(item.store))}>{item.store}</span>
                  </div>
                </div>

                <div className="flex-1 p-6">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm text-gray-500 uppercase tracking-wide">{item.brand || 'Unbranded'}</p>
                      <h3 className="text-2xl font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-gray-900">{item.price}</p>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                      {item.last_scraped && (
                        <p className="text-xs text-gray-400">Updated {formatDate(item.last_scraped)}</p>
                      )}
                    </div>
                  </div>

                  {item.product_url && (
                    <div className="mt-3">
                      <a
                        href={item.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary-600 hover:underline"
                      >
                        View on store website
                      </a>
                    </div>
                  )}

                  <div className="mt-5 border-t pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                        Price at other stores
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        disabled={removingId === item.id}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                        {removingId === item.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>

                    {item.alternative_prices.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No identical items found at other stores.
                      </p>
                    )}

                    {item.alternative_prices.length > 0 && (
                      <div className="divide-y rounded-lg border border-gray-100">
                        {item.alternative_prices
                          .filter((alt) => !isAltDiscarded(item.id, alt.id))
                          .map((alt) => {
                            const needsApproval = alt.needs_approval && !isAltApproved(item.id, alt);
                            const isApproved = isAltApproved(item.id, alt);
                            
                            return (
                              <div 
                                key={alt.id} 
                                className={cn(
                                  "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between",
                                  needsApproval && "bg-amber-50 border-l-4 border-l-amber-400",
                                  isApproved && "bg-green-50 border-l-4 border-l-green-400"
                                )}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={cn('badge', getStoreBadgeClass(alt.store))}>{alt.store}</span>
                                    <p className="text-sm font-semibold text-gray-900">{alt.name}</p>
                                    {alt.is_fallback && alt.fallback_type === 'same_brand_diff_size' && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                        Same Brand, Different Size
                                      </span>
                                    )}
                                    {alt.is_fallback && alt.fallback_type === 'same_size_diff_brand' && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                                        Same Size, Different Brand
                                      </span>
                                    )}
                                    {needsApproval && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                        Needs Review
                                      </span>
                                    )}
                                    {isApproved && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                        <CheckCircle className="w-3 h-3" /> Approved
                                      </span>
                                    )}
                                    {!alt.needs_approval && !isApproved && !alt.is_fallback && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                        <CheckCircle className="w-3 h-3" /> Auto-matched
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    {alt.brand && <span>Brand: {alt.brand}</span>}
                                    {alt.size && <span>Size: {alt.size}</span>}
                                    {alt.size_matched && <span className="text-green-600">✓ Size match</span>}
                                    {alt.brand_matched && <span className="text-green-600">✓ Brand match</span>}
                                    {!alt.size_matched && alt.size && <span className="text-amber-600">⚠ Size differs</span>}
                                    {!alt.brand_matched && alt.brand && <span className="text-amber-600">⚠ Brand differs</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-gray-900">{alt.price}</p>
                                    {alt.product_url && (
                                      <a
                                        href={alt.product_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary-600 hover:underline"
                                      >
                                        View product
                                      </a>
                                    )}
                                  </div>
                                  {/* Approve/Discard buttons for items needing approval */}
                                  {alt.needs_approval && (
                                    <div className="flex items-center gap-2">
                                      {!isApproved && (
                                        <button
                                          type="button"
                                          onClick={() => handleApproveAlt(item.id, alt)}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                                          title="Approve this match"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                          Approve
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDiscardAlt(item.id, alt)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                                        title="Discard this match"
                                      >
                                        <XCircle className="w-4 h-4" />
                                        Discard
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
