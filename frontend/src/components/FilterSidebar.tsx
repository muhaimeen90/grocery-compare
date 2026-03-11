'use client';

import { cn } from '@/lib/utils';
import { ArrowDownAZ, ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react';

type SortOption = 'name' | 'price_low' | 'price_high';

interface FilterSidebarProps {
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'name', label: 'Name A–Z', icon: <ArrowDownAZ className="w-3.5 h-3.5" /> },
  { value: 'price_low', label: 'Cheapest first', icon: <ArrowDownNarrowWide className="w-3.5 h-3.5" /> },
  { value: 'price_high', label: 'Most expensive', icon: <ArrowUpNarrowWide className="w-3.5 h-3.5" /> },
];

export default function FilterSidebar({ currentSort, onSortChange }: FilterSidebarProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="section-label mb-3">Sort by</p>
      <div className="space-y-1">
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSortChange(opt.value)}
            className={cn(
              'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors',
              currentSort === opt.value
                ? 'bg-primary-50 text-primary-700'
                : 'text-zinc-600 hover:bg-zinc-50'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

