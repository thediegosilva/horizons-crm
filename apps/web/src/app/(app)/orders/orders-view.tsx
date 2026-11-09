'use client';

import { ORDER_STATUS_LABELS, ORDER_STATUSES } from '@horizons/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { PageHeader, SearchInput } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { OrdersTable } from '@/features/orders/orders-table';
import { useAuth } from '@/hooks/use-auth';
import { useUrlState } from '@/hooks/use-url-state';
import { api, errorMessage } from '@/lib/api';
import type { OrderSummary, Paginated } from '@/lib/types';
import { cn } from '@/lib/utils';

export function OrdersView() {
  const { can } = useAuth();
  const [q, setQ] = useUrlState(['search', 'status', 'from', 'to', 'page'] as const);
  const params = { search: q.search, status: q.status, from: q.from, to: q.to, page: q.page || 1, pageSize: 15 };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', params],
    queryFn: () => api<Paginated<OrderSummary>>('/orders', { query: params }),
    placeholderData: keepPreviousData,
  });
  const hasFilters = Boolean(q.search || q.status || q.from || q.to);

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Orçamentos, vendas e acompanhamento do fluxo de cada pedido."
        actions={can('orders:write') && <Button asChild><Link href="/orders/new"><Plus /> Novo pedido</Link></Button>}
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Filtrar por status" className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {[{ value: '', label: 'Todos' }, ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))].map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={q.status === s.value}
              onClick={() => setQ({ status: s.value })}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
                q.status === s.value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <SearchInput className="md:max-w-xs md:flex-1" value={q.search} onChange={(v) => setQ({ search: v })} placeholder="Nº do pedido ou cliente" />
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="from">Data inicial</label>
            <Input id="from" type="date" className="w-auto" value={q.from} max={q.to || undefined} onChange={(e) => setQ({ from: e.target.value })} />
            <span className="text-sm text-muted-foreground">até</span>
            <label className="sr-only" htmlFor="to">Data final</label>
            <Input id="to" type="date" className="w-auto" value={q.to} min={q.from || undefined} onChange={(e) => setQ({ to: e.target.value })} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => setQ({ search: null, status: null, from: null, to: null })}>Limpar filtros</Button>
          )}
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={ShoppingCart}
            title={hasFilters ? 'Nenhum pedido encontrado' : 'Nenhum pedido ainda'}
            description={hasFilters ? 'Ajuste a pesquisa ou os filtros.' : 'Crie um orçamento para começar a vender.'}
            action={!hasFilters && can('orders:write') ? <Button asChild><Link href="/orders/new"><Plus /> Novo pedido</Link></Button> : undefined}
          />
        ) : (
          <>
            <OrdersTable orders={data.data} />
            <Pagination meta={data.meta} onPageChange={(p) => setQ({ page: p }, false)} />
          </>
        )}
      </Card>
    </>
  );
}
