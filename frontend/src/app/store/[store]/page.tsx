'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';
import type { CategoryCount } from '@/lib/types';
import { ChevronRight, Package } from 'lucide-react';
import { CategoryGridSkeleton } from '@/components/ui/Skeletons';
import { cn } from '@/lib/utils';

const storeTheme: Record<string, { accent: string; bg: string; badge: string; dot: string }> = {
  iga: {
    accent: 'text-red-700',
    bg: 'from-red-50 to-zinc-50',
    badge: 'bg-red-50 border-red-200 text-red-700',
    dot: 'bg-red-500',
  },
  woolworths: {
    accent: 'text-green-700',
    bg: 'from-green-50 to-zinc-50',
    badge: 'bg-green-50 border-green-200 text-green-700',
    dot: 'bg-green-500',
  },
  coles: {
    accent: 'text-red-800',
    bg: 'from-red-50 to-zinc-50',
    badge: 'bg-red-50 border-red-200 text-red-800',
    dot: 'bg-red-600',
  },
  aldi: {
    accent: 'text-blue-700',
    bg: 'from-blue-50 to-zinc-50',
    badge: 'bg-blue-50 border-blue-200 text-blue-700',
    dot: 'bg-blue-500',
  },
};

const CATEGORY_ICONS: Record<string, string> = {
  'Dairy & Eggs': '🥛',
  'Bakery': '🍞',
  'Fruits & Vegetables': '🥦',
  'Meat & Seafood': '🥩',
  'Drinks': '🥤',
  'Snacks': '🍪',
  'Frozen': '🧊',
  'Pantry': '🫙',
  'Health & Beauty': '💊',
  'Cleaning': '🧹',
  'Pets': '🐾',
  'Baby': '🍼',
  'Liquor': '🍷',
};

function getCategoryIcon(name: string): string {
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '📦';
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' as const } },
};

export default function StorePage() {
  const params = useParams();
  const store = params.store as string;
  const theme = storeTheme[store.toLowerCase()] ?? storeTheme.aldi;

  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.getCategories(store)
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [store]);

  const totalProducts = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div>
      {/* Store hero banner */}
      <div className={cn('bg-gradient-to-b py-10', theme.bg)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="mb-3">
                <Image
                  src={`/assets/logos/${store.toLowerCase()}.png`}
                  alt={`${store} logo`}
                  width={120}
                  height={48}
                  className="object-contain"
                />
              </div>
              {/* <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-1 tracking-tight">{store}</h1> */}
              <p className="text-zinc-500 text-sm">
                {loading ? 'Loading…' : `${categories.length} categories · ${totalProducts.toLocaleString()} products`}
              </p>
            </div>

            <Link href={`/store/${store}/all`} className="btn-primary">
              Browse all products
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">Browse by category</h2>

        {loading ? (
          <CategoryGridSkeleton />
        ) : (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {categories.map((category) => (
              <motion.div key={category.name} variants={itemVariants}>
                <Link
                  href={`/store/${store}/${encodeURIComponent(category.name)}`}
                  className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-card-hover transition-all"
                >
                  <span className="text-2xl mb-2 select-none">{getCategoryIcon(category.name)}</span>
                  <h3 className="text-xs font-semibold text-zinc-900 line-clamp-2 leading-snug mb-1">
                    {category.name}
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-auto">
                    {category.count} product{category.count !== 1 ? 's' : ''}
                  </p>
                  <ChevronRight className={cn('w-3.5 h-3.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity', theme.accent)} />
                </Link>
              </motion.div>
            ))}

            {categories.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <Package className="w-10 h-10 text-zinc-300 mb-3" />
                <p className="text-sm text-zinc-500">No categories found for {store}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

