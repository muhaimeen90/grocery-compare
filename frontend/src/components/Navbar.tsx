'use client';

import Link from 'next/link';
import { ShoppingCart, Search, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const stores = ['IGA', 'Woolworths', 'Coles'];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Global search - redirect to first store with search param
      router.push(`/store/${stores[0]}/all?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <ShoppingCart className="w-8 h-8 text-primary-600 group-hover:scale-110 transition-transform" />
            <span className="text-xl font-bold text-gray-900">
              Grocery<span className="text-primary-600">Compare</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {stores.map((store) => (
              <Link
                key={store}
                href={`/store/${store}`}
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                {store}
              </Link>
            ))}

            <Link
              href="/cart"
              className="inline-flex items-center gap-1 rounded-full border border-primary-100 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              <ShoppingBag className="w-4 h-4" />
              Cart
            </Link>
          </div>

          {/* Search */}
          <div className="flex items-center">
            {!searchOpen && (
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
            
            {searchOpen && (
              <form onSubmit={handleSearch} className="flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="input w-64"
                  autoFocus
                  onBlur={() => {
                    if (!searchQuery) setSearchOpen(false);
                  }}
                />
              </form>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-4 flex space-x-4 overflow-x-auto">
          {stores.map((store) => (
            <Link
              key={store}
              href={`/store/${store}`}
              className="text-sm text-gray-700 hover:text-primary-600 font-medium whitespace-nowrap"
            >
              {store}
            </Link>
          ))}

          <Link
            href="/cart"
            className="flex items-center gap-1 text-sm text-primary-700 font-semibold whitespace-nowrap"
          >
            <ShoppingBag className="w-4 h-4" />
            Cart
          </Link>
        </div>
      </div>
    </nav>
  );
}
