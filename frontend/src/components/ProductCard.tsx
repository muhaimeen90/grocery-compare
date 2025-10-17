'use client';

import Image from 'next/image';
import type { Product } from '@/lib/types';
import { getStoreBadgeClass, getImageUrl, formatDate, cn } from '@/lib/utils';
import PriceUpdateButton from './PriceUpdateButton';
import { ExternalLink } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onPriceUpdate?: () => void;
}

export default function ProductCard({ product, onPriceUpdate }: ProductCardProps) {
  return (
    <div className="card card-hover animate-fade-in">
      {/* Image */}
      <div className="relative aspect-square bg-gray-100">
        <Image
          src={getImageUrl(product.image_url)}
          alt={product.name}
          fill
          className="object-contain p-4"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.png';
          }}
        />
        
        {/* Store Badge */}
        <div className="absolute top-2 left-2">
          <span className={cn('badge', getStoreBadgeClass(product.store))}>
            {product.store}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Brand */}
        {product.brand && (
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            {product.brand}
          </p>
        )}

        {/* Name */}
        <h3 className="font-medium text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Category */}
        <p className="text-xs text-gray-500 mb-3">{product.category}</p>

        {/* Price */}
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-2xl font-bold text-gray-900">
            {product.price}
          </span>
          {product.last_scraped && (
            <span className="text-xs text-gray-500">
              Updated {formatDate(product.last_scraped)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <PriceUpdateButton
            productId={product.id}
            onSuccess={onPriceUpdate}
          />
          
          {product.product_url && (
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center"
              title="View on store website"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
