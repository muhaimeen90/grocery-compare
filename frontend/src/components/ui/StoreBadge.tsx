'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface StoreBadgeProps {
  store: string;
  size?: 'sm' | 'md';
  className?: string;
}

const storeConfig: Record<string, { label: string; logo: string; className: string }> = {
  iga: {
    label: 'IGA',
    logo: '/assets/logos/iga.png',
    className: 'bg-red-50 ring-1 ring-red-200',
  },
  woolworths: {
    label: 'Woolworths',
    logo: '/assets/logos/woolworths.png',
    className: 'bg-green-50 ring-1 ring-green-200',
  },
  coles: {
    label: 'Coles',
    logo: '/assets/logos/coles.png',
    className: 'bg-red-50 ring-1 ring-red-200',
  },
  aldi: {
    label: 'Aldi',
    logo: '/assets/logos/aldi.png',
    className: 'bg-blue-50 ring-1 ring-blue-200',
  },
};

export default function StoreBadge({ store, size = 'sm', className }: StoreBadgeProps) {
  const key = store.toLowerCase();
  const config = storeConfig[key];

  // Fallback: no logo available
  if (!config) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-md font-semibold tracking-wide bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200',
          size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
          className
        )}
      >
        {store}
      </span>
    );
  }

  const logoSize = size === 'sm' ? 40 : 52;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg bg-white/90 backdrop-blur-sm shadow-md',
        size === 'sm' ? 'p-1.5' : 'p-2',
        className
      )}
    >
      <Image
        src={config.logo}
        alt={config.label}
        width={logoSize}
        height={logoSize}
        className="object-contain flex-shrink-0"
      />
    </span>
  );
}
