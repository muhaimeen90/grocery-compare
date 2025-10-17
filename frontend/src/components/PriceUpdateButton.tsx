'use client';

import { useScraping } from '@/hooks/useScraping';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceUpdateButtonProps {
  productId: number;
  onSuccess?: () => void;
}

export default function PriceUpdateButton({ productId, onSuccess }: PriceUpdateButtonProps) {
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
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Updating...</span>
        </>
      );
    }

    if (status?.status === 'success') {
      return (
        <>
          <Check className="w-4 h-4" />
          <span>Updated</span>
        </>
      );
    }

    if (status?.status === 'error' || error) {
      return (
        <>
          <AlertCircle className="w-4 h-4" />
          <span>Failed</span>
        </>
      );
    }

    return (
      <>
        <RefreshCw className="w-4 h-4" />
        <span>Update Price</span>
      </>
    );
  };

  const getButtonClass = () => {
    if (status?.status === 'success') {
      return 'bg-green-600 hover:bg-green-700 text-white';
    }
    if (status?.status === 'error' || error) {
      return 'bg-red-600 hover:bg-red-700 text-white';
    }
    return 'bg-primary-600 hover:bg-primary-700 text-white';
  };

  return (
    <button
      onClick={handleClick}
      disabled={scraping || status?.status === 'scraping' || status?.status === 'pending'}
      className={cn(
        'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        getButtonClass()
      )}
      title={status?.message || error || 'Scrape live price from store website'}
    >
      {getButtonContent()}
    </button>
  );
}
