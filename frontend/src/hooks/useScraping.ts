'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { ScrapeStatus } from '@/lib/types';

export function useScraping(productId: number | null) {
  const [scraping, setScraping] = useState(false);
  const [status, setStatus] = useState<ScrapeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startScrape = async () => {
    if (!productId) return;

    setScraping(true);
    setError(null);

    try {
      const result = await apiClient.scrapePrice(productId);
      pollStatus(result.task_id);
    } catch (err: any) {
      setError(err.message || 'Failed to start scraping');
      setScraping(false);
    }
  };

  const pollStatus = async (taskId: string) => {
    const maxAttempts = 60; // 60 seconds max
    let attempts = 0;

    const poll = async () => {
      try {
        const result = await apiClient.getScrapeStatus(taskId);
        setStatus(result);

        if (result.status === 'success' || result.status === 'error') {
          setScraping(false);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setError('Scraping timed out');
          setScraping(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to check status');
        setScraping(false);
      }
    };

    poll();
  };

  return {
    scraping,
    status,
    error,
    startScrape,
  };
}
