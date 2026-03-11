'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const stores = ['IGA', 'Woolworths', 'Coles', 'Aldi'];

const storeAccent: Record<string, string> = {
  IGA: 'hover:text-rose-600',
  Woolworths: 'hover:text-green-600',
  Coles: 'hover:text-red-600',
  Aldi: 'hover:text-blue-600',
};

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className={cn(
          'sticky top-0 z-40 w-full transition-all duration-200',
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-[#e5e7eb] shadow-soft'
            : 'bg-white border-b border-[#e5e7eb]'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#22c55e] text-white shadow-sm group-hover:bg-[#16a34a] transition-colors">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-2xl font-bold text-zinc-900 tracking-tight">
                  Deals <span className="text-primary-600">by Sysnolodge</span>
                </span>
            
              </div>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {stores.map((store) => {
                const active = pathname.startsWith(`/store/${store}`);
                return (
                  <Link
                    key={store}
                    href={`/store/${store}`}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-zinc-100 text-zinc-900'
                        : `text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 ${storeAccent[store]}`,
                    )}
                  >
                    {store}
                  </Link>
                );
              })}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/cart"
                className={cn(
                  'btn-secondary h-8 px-3 text-xs',
                  pathname === '/cart' && 'bg-zinc-100 border-zinc-300'
                )}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Cart
              </Link>
            </div>
          </div>

  

          {/* Mobile store nav */}
          <div className="md:hidden pb-2 flex gap-1 overflow-x-auto no-scrollbar">
            {stores.map((store) => (
              <Link
                key={store}
                href={`/store/${store}`}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                  pathname.startsWith(`/store/${store}`)
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50'
                )}
              >
                {store}
              </Link>
            ))}
          </div>
        </div>
      </nav>

    </>
  );
}

