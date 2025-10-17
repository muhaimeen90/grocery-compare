'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { CategoryCount } from '@/lib/types';
import { ChevronRight, Package } from 'lucide-react';
import LoadingSkeleton from '@/components/LoadingSkeleton';

export default function StorePage() {
  const params = useParams();
  const store = params.store as string;
  
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await apiClient.getCategories(store);
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [store]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{store}</h1>
        <p className="text-gray-600">
          Browse products by category ({categories.length} categories)
        </p>
      </div>

      {/* Categories Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map((category) => (
          <Link
            key={category.name}
            href={`/store/${store}/${encodeURIComponent(category.name)}`}
            className="card card-hover p-6 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <Package className="w-5 h-5 text-primary-600 mr-2" />
                  <h3 className="font-semibold text-gray-900 line-clamp-2">
                    {category.name}
                  </h3>
                </div>
                <p className="text-sm text-gray-500">
                  {category.count} {category.count === 1 ? 'product' : 'products'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
            </div>
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No categories found</p>
        </div>
      )}
    </div>
  );
}
