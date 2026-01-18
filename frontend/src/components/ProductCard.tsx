'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Product } from '@/lib/types';
import { getStoreBadgeClass, getImageUrl, formatDate, cn, getOrCreateSessionId } from '@/lib/utils';
import PriceUpdateButton from './PriceUpdateButton';
import { ExternalLink, ShoppingCart } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface ProductCardProps {
  product: Product;
  onPriceUpdate?: (product: Product) => void;
}

export default function ProductCard({ product, onPriceUpdate }: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
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
    } catch (err) {
      console.error('Failed to add to cart', err);
      setError('Could not add to cart. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md h-full">
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-gray-50 overflow-hidden">
        <Image
          src={getImageUrl(product.image_url)}
          alt={product.name}
          fill
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.svg';
            target.style.padding = '2rem';
          }}
        />
        
        {/* Store Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shadow-sm', getStoreBadgeClass(product.store))}>
            {product.store}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand & Size */}
        <div className="flex items-center gap-2 mb-1">
          {product.brand && (
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {product.brand}
            </p>
          )}
          {product.brand && product.size && (
            <span className="text-gray-300">•</span>
          )}
          {product.size && (
            <p className="text-xs text-gray-400">
              {product.size}
            </p>
          )}
        </div>

        {/* Name */}
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem]" title={product.name}>
          {product.name}
        </h3>

        {/* Category - Optional, maybe hide to save space or keep small */}
        {/* <p className="text-xs text-gray-500 mb-3">{product.category}</p> */}

        {/* Price */}
        <div className="mt-auto">
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-gray-900">
              {product.price}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAdding}
            className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <ShoppingCart className="w-4 h-4" />
            {isAdding ? 'Adding...' : justAdded ? 'Added' : 'Add'}
          </button>

          <PriceUpdateButton
            productId={product.id}
            onSuccess={onPriceUpdate}
            compact={true}
          />
          
          {product.product_url && (
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
              title="View on store website"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600 animate-in fade-in slide-in-from-top-1">{error}</p>
        )}
      </div>
    </div>
  );
}
