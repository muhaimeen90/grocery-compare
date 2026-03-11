'use client';

import Image from 'next/image';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '@/lib/types';
import { getImageUrl, formatDate, getOrCreateSessionId } from '@/lib/utils';
import { ExternalLink, ShoppingCart, Check, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import StoreBadge from '@/components/ui/StoreBadge';

interface ProductCardProps {
  product: Product;
  onPriceUpdate?: (product: Product) => void;
}

export default function ProductCard({ product, onPriceUpdate }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddToCart = async () => {
    if (isAdding) return;
    const sessionId = getOrCreateSessionId();
    if (!sessionId) return;

    try {
      setIsAdding(true);
      setError(null);
      await apiClient.addToCart(product.id, sessionId);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2500);
    } catch {
      setError('Could not add to cart.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (isScraping) return;
    try {
      setIsScraping(true);
      setError(null);
      const { task_id } = await apiClient.scrapePrice(product.id);
      // Poll for result
      const poll = async (attempts: number) => {
        if (attempts <= 0) { setIsScraping(false); return; }
        const status = await apiClient.getScrapeStatus(task_id);
        if (status.status === 'success' && status.product) {
          onPriceUpdate?.(status.product);
          setIsScraping(false);
        } else if (status.status === 'error') {
          setError('Price update failed.');
          setIsScraping(false);
        } else {
          setTimeout(() => poll(attempts - 1), 1500);
        }
      };
      setTimeout(() => poll(10), 1000);
    } catch {
      setError('Could not update price.');
      setIsScraping(false);
    }
  };

  return (
    <motion.div
      layout
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-zinc-200/80 shadow-card transition-shadow hover:shadow-card-hover"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-zinc-50 overflow-hidden">
        <Image
          src={getImageUrl(product.image_url)}
          alt={product.name}
          fill
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.svg';
            target.style.padding = '2.5rem';
          }}
        />

        {/* Store badge overlay */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <StoreBadge store={product.store} />
        </div>

        {/* External link */}
        {product.product_url && (
          <div className="absolute top-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-zinc-600 shadow-soft hover:text-zinc-900 backdrop-blur-sm transition-colors"
              title="View on store website"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 pt-3.5">
        {/* Brand + size */}
        {(product.brand || product.size) && (
          <div className="flex items-center gap-1.5 mb-1">
            {product.brand && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {product.brand}
              </span>
            )}
            {product.brand && product.size && (
              <span className="text-zinc-300 text-xs">·</span>
            )}
            {product.size && (
              <span className="text-[11px] text-zinc-400">{product.size}</span>
            )}
          </div>
        )}

        {/* Name */}
        <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug min-h-[2.5rem]" title={product.name}>
          {product.name}
        </h3>

        {/* Price row */}
        <div className="mt-auto pt-3 flex items-end justify-between">
          <span className="text-xl font-bold tracking-tight text-[#16a34a]">
            {product.price}
          </span>
          {product.last_scraped && (
            <span className="text-[11px] text-zinc-400 leading-none pb-0.5">
              {formatDate(product.last_scraped)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAdding}
            className="flex-1 btn-primary h-8 px-3 text-xs"
          >
            <AnimatePresence mode="wait" initial={false}>
              {justAdded ? (
                <motion.span
                  key="added"
                  className="flex items-center gap-1"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Check className="w-3.5 h-3.5" />
                  Added
                </motion.span>
              ) : (
                <motion.span
                  key="add"
                  className="flex items-center gap-1"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {isAdding ? 'Adding…' : 'Add'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600 animate-fade-in">{error}</p>
        )}
      </div>
    </motion.div>
  );
}

