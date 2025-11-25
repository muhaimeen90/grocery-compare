'use client';

import { useScraping } from '@/hooks/useScraping';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceUpdateButtonProps {
  productId: number;
  onSuccess?: () => void;
  compact?: boolean;
}

export default function PriceUpdateButton({ productId, onSuccess, compact = false }: PriceUpdateButtonProps) {
  const { scraping, status, error, startScrape } = useScraping(productId);

  const handleClick = async () => {
    await startScrape();
    if (status?.status === 'success' && onSuccess) {
      onSuccess();
    }
  };

  const getButtonContent = () => {
    if (scraping || status?.status === 'scraping' || status?.status === 'pending') {
      return (
        <>
          <RefreshCw className={cn("w-4 h-4 animate-spin", !compact && "mr-2")} />
          {!compact && <span>Updating...</span>}
        </>
      );
    }

    if (status?.status === 'success') {
      return (
        <>
          <Check className={cn("w-4 h-4", !compact && "mr-2")} />
          {!compact && <span>Updated</span>}
        </>
      );
    }

    if (status?.status === 'error' || error) {
      return (
        <>
          <AlertCircle className={cn("w-4 h-4", !compact && "mr-2")} />
          {!compact && <span>Failed</span>}
        </>
      );
    }

    return (
      <>
        <RefreshCw className={cn("w-4 h-4", !compact && "mr-2")} />
        {!compact && <span>Update Price</span>}
      </>
    );
  };

  const getButtonClass = () => {
    if (status?.status === 'success') {
      return 'bg-green-600 hover:bg-green-700 text-white border-transparent';
    }
    if (status?.status === 'error' || error) {
      return 'bg-red-600 hover:bg-red-700 text-white border-transparent';
    }
    return 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300';
  };

  return (
    <button
      onClick={handleClick}
      disabled={scraping || status?.status === 'scraping' || status?.status === 'pending'}
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border shadow-sm',
        compact ? 'h-9 w-9 p-0' : 'h-9 px-4 py-2',
        getButtonClass()
      )}
      title={status?.message || error || 'Scrape live price from store website'}
    >
      {getButtonContent()}
    </button>
  );
}
