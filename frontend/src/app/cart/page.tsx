'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Check, ExternalLink, Loader2, ShoppingBag, Trash2 } from 'lucide-react';

import { apiClient } from '@/lib/api';
import type { CartItemWithAlternatives } from '@/lib/types';
import { formatDate, getImageUrl, getOrCreateSessionId } from '@/lib/utils';
import StoreBadge from '@/components/ui/StoreBadge';

export default function CartPage() {
  const router = useRouter();
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

  const handleConfirm = () => {
    if (items.length === 0) return;

    // Auto-select all items
    const allProductIds = items.map(item => item.id);

    // Store all product IDs in localStorage for the confirm page
    localStorage.setItem('selectedCartItems', JSON.stringify(allProductIds));
    localStorage.setItem('sessionId', sessionId);

    // Navigate to location selection page before comparison
    router.push(`/cart/location?session=${sessionId}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Your Cart</h1>
          <p className="text-sm text-zinc-500">Review items and compare prices across stores.</p>
        </div>
      </div>

      {loading && (
        <div className="card p-8 flex items-center gap-3 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading your cart…</span>
        </div>
      )}

      {!loading && error && (
        <div className="card p-5 flex items-start gap-3 text-red-700 border-red-100 bg-red-50">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">{error}</p>
            <button onClick={() => fetchCart(sessionId)} className="text-xs underline mt-1">Try again</button>
          </div>
        </div>
      )}

      {!loading && !error && !hasItems && (
        <div className="card p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 mx-auto mb-4">
            <ShoppingBag className="w-7 h-7 text-zinc-400" />
          </div>
          <h2 className="text-base font-semibold text-zinc-900 mb-1">Your cart is empty</h2>
          <p className="text-sm text-zinc-500 mb-6">Browse products and add them to compare prices.</p>
          <Link href="/" className="btn-primary">
            Start shopping
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {!loading && !error && hasItems && (
        <div className="space-y-5">
          {/* Compare CTA */}
          <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-primary-50 border-primary-100">
            <div>
              <p className="text-sm font-semibold text-primary-900">Ready to compare prices?</p>
              <p className="text-xs text-primary-600 mt-0.5">We&apos;ll show you the cheapest store for your basket.</p>
            </div>
            <button type="button" onClick={handleConfirm} className="btn-primary flex-shrink-0">
              <Check className="w-4 h-4" />
              Compare prices
            </button>
          </div>

          {/* Cart items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, idx) => (
              <motion.div
                key={item.cart_item_id}
                className="card overflow-hidden"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="flex gap-4 p-4">
                  {/* Image */}
                  <div className="relative h-20 w-20 flex-shrink-0 rounded-xl overflow-hidden bg-zinc-50">
                    <Image
                      src={getImageUrl(item.image_url)}
                      alt={item.name}
                      fill
                      className="object-contain p-2"
                      sizes="80px"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {item.brand && (
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">{item.brand}</p>
                        )}
                        <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <StoreBadge store={item.store} />
                          {item.size && <span className="text-xs text-zinc-400">{item.size}</span>}
                        </div>
                      </div>
                      {/* Price */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-zinc-900">{item.price}</p>
                        {item.last_scraped && (
                          <p className="text-[11px] text-zinc-400 mt-0.5">{formatDate(item.last_scraped)}</p>
                        )}
                      </div>
                    </div>

                    {/* Footer row */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
                      {item.product_url ? (
                        <a
                          href={item.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View on store
                        </a>
                      ) : <span />}

                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        disabled={removingId === item.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {removingId === item.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
