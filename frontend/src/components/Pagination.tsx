'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const showPages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
  let endPage = Math.min(totalPages, startPage + showPages - 1);
  if (endPage - startPage < showPages - 1) {
    startPage = Math.max(1, endPage - showPages + 1);
  }
  const pages: number[] = [];
  for (let i = startPage; i <= endPage; i++) pages.push(i);

  const btnBase = 'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(btnBase, 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed px-2')}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {startPage > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className={cn(btnBase, 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 px-3')}>1</button>
          {startPage > 2 && <span className="px-1 text-zinc-400 text-sm">…</span>}
        </>
      )}

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={cn(
            btnBase, 'px-3',
            page === currentPage
              ? 'bg-primary-600 border-primary-600 text-white hover:bg-primary-500'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          )}
        >
          {page}
        </button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-1 text-zinc-400 text-sm">…</span>}
          <button onClick={() => onPageChange(totalPages)} className={cn(btnBase, 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 px-3')}>{totalPages}</button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(btnBase, 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed px-2')}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

