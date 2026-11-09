'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import { Button } from './button';

export function Pagination({ meta, onPageChange }: { meta: PageMeta; onPageChange: (page: number) => void }) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <nav aria-label="Paginação" className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
      <p className="text-xs text-muted-foreground tabular">
        Exibindo <strong className="font-medium text-foreground">{from}–{to}</strong> de{' '}
        <strong className="font-medium text-foreground">{formatNumber(meta.total)}</strong>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Página anterior">
          <ChevronLeft /> Anterior
        </Button>
        <span className="text-xs text-muted-foreground tabular">
          {meta.page} / {meta.totalPages}
        </span>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)} aria-label="Próxima página">
          Próxima <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
