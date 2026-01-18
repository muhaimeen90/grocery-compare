'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { ScrapeStatus, Product } from '@/lib/types';

export function useScraping(productId: number | null) {
  const [scraping, setScraping] = useState(false);
  const [status, setStatus] = useState<ScrapeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScrape = async (): Promise<Product | null> => {
    if (!productId) return null;

    setScraping(true);
    setError(null);
    setStatus(null);

    try {
      const result = await apiClient.scrapePrice(productId);
      const scrapedProduct = await pollStatus(result.task_id);
      return scrapedProduct;
    } catch (err: any) {
      setError(err.message || 'Failed to start scraping');
      setScraping(false);
      return null;
    }
  };

  const pollStatus = async (taskId: string): Promise<Product | null> => {
    const maxAttempts = 60; // 60 seconds max
    let attempts = 0;

    return new Promise((resolve) => {
      const poll = async () => {
        try {
          const result = await apiClient.getScrapeStatus(taskId);
          setStatus(result);

          if (result.status === 'success') {
            setScraping(false);
            resolve(result.product || null);
            return;
          }

          if (result.status === 'error') {
            setScraping(false);
            setError(result.message || 'Scraping failed');
            resolve(null);
            return;
          }

          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 1000);
          } else {
            setError('Scraping timed out');
            setScraping(false);
            resolve(null);
          }
        } catch (err: any) {
          setError(err.message || 'Failed to check status');
          setScraping(false);
          resolve(null);
        }
      };

      poll();
    });
  };

  return {
    scraping,
    status,
    error,
    startScrape,
  };
}
