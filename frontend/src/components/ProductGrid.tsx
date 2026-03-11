'use client';

import { motion } from 'framer-motion';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';
import { Package } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  onPriceUpdate?: (product: Product) => void;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' as const } },
};

export default function ProductGrid({ products, onPriceUpdate }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 mb-4">
          <Package className="w-8 h-8 text-zinc-400" />
        </div>
        <h3 className="text-base font-semibold text-zinc-900 mb-1">No products found</h3>
        <p className="text-sm text-zinc-500 max-w-xs">Try adjusting your filters or searching with a different term.</p>
      </div>
    );
  }

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {products.map((product) => (
        <motion.div key={product.id} variants={itemVariants}>
          <ProductCard product={product} onPriceUpdate={onPriceUpdate} />
        </motion.div>
      ))}
    </motion.div>
  );
}

