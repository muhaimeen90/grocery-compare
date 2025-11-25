'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, Loader2, ShoppingBag, Trash2 } from 'lucide-react';

import { apiClient } from '@/lib/api';
import type { CartItemWithAlternatives } from '@/lib/types';
import { cn, formatDate, getImageUrl, getOrCreateSessionId, getStoreBadgeClass } from '@/lib/utils';

export default function CartPage() {
  const [items, setItems] = useState<CartItemWithAlternatives[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [removingId, setRemovingId] = useState<number | null>(null);

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
          {items.map((item) => (
            <div key={item.cart_item_id} className="card overflow-hidden">
              <div className="flex flex-col md:flex-row">
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
                        {item.alternative_prices.map((alt) => (
                          <div key={alt.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={cn('badge', getStoreBadgeClass(alt.store))}>{alt.store}</span>
                                <p className="text-sm font-semibold text-gray-900">{alt.name}</p>
                              </div>
                              {alt.brand && <p className="text-xs text-gray-500">{alt.brand}</p>}
                            </div>
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
                          </div>
                        ))}
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
