'use client';

import { PRODUCT_TYPE_LABELS } from '@horizons/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, MoreHorizontal, Package, Pencil, Plus, Trash2, Wrench } from 'lucide-react';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { PageHeader, SearchInput } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { ProductFormDialog } from '@/features/products/product-form-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useDeleteMutation } from '@/hooks/use-delete';
import { useUrlState } from '@/hooks/use-url-state';
import { api, errorMessage } from '@/lib/api';
import { formatCents, formatNumber } from '@/lib/format';
import type { Paginated, Product } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ProductsView() {
  const { can } = useAuth();
  const [q, setQ] = useUrlState(['search', 'type', 'category', 'active', 'lowStock', 'sort', 'page'] as const);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | undefined>();
  const [deleting, setDeleting] = React.useState<Product | null>(null);

  const sort = q.sort || 'createdAt:desc';
  const [sortField, sortOrder] = sort.split(':');
  const params = {
    search: q.search, type: q.type, category: q.category, active: q.active, lowStock: q.lowStock,
    page: q.page || 1, pageSize: 15, sort: sortField, order: sortOrder,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products', params],
    queryFn: () => api<Paginated<Product>>('/products', { query: params }),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => api<{ data: string[] }>('/products/categories').then((r) => r.data),
  });
  const del = useDeleteMutation({
    path: (id) => `/products/${id}`,
    invalidate: [['products'], ['product-categories']],
    success: 'Produto excluído.',
    onSettled: () => setDeleting(null),
  });

  const hasFilters = Boolean(q.search || q.type || q.category || q.active || q.lowStock);

  return (
    <>
      <PageHeader
        title="Produtos e serviços"
        description="Catálogo, preços e controle de estoque."
        actions={can('products:write') && <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus /> Novo produto</Button>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center">
          <SearchInput className="xl:max-w-xs xl:flex-1" value={q.search} onChange={(v) => setQ({ search: v })} placeholder="Nome, SKU ou categoria" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select aria-label="Tipo" value={q.type} onChange={(e) => setQ({ type: e.target.value })} className="sm:w-36">
              <option value="">Todos os tipos</option>
              <option value="PRODUCT">Produtos</option>
              <option value="SERVICE">Serviços</option>
            </Select>
            <Select aria-label="Categoria" value={q.category} onChange={(e) => setQ({ category: e.target.value })} className="sm:w-44">
              <option value="">Todas as categorias</option>
              {categories.data?.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select aria-label="Disponibilidade" value={q.active} onChange={(e) => setQ({ active: e.target.value })} className="sm:w-36">
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </Select>
            <Select aria-label="Ordenar" value={sort} onChange={(e) => setQ({ sort: e.target.value === 'createdAt:desc' ? null : e.target.value })} className="sm:w-44">
              <option value="createdAt:desc">Mais recentes</option>
              <option value="name:asc">Nome (A–Z)</option>
              <option value="priceCents:desc">Maior preço</option>
              <option value="priceCents:asc">Menor preço</option>
              <option value="stock:asc">Menor estoque</option>
            </Select>
          </div>
          <Button
            variant={q.lowStock ? 'primary' : 'secondary'}
            size="md"
            aria-pressed={!!q.lowStock}
            onClick={() => setQ({ lowStock: q.lowStock ? null : 'true' })}
          >
            <AlertTriangle /> Estoque baixo
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={Package}
            title={hasFilters ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
            description={hasFilters ? 'Ajuste a pesquisa ou os filtros.' : 'Cadastre produtos e serviços para usá-los nos pedidos.'}
            action={hasFilters ? <Button variant="secondary" onClick={() => setQ({ search: null, type: null, category: null, active: null, lowStock: null })}>Limpar filtros</Button> : undefined}
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Produto</TH>
                  <TH className="hidden md:table-cell">Categoria</TH>
                  <TH className="text-right">Preço</TH>
                  <TH className="text-right">Estoque</TH>
                  <TH className="hidden sm:table-cell">Status</TH>
                  <TH className="w-12"><span className="sr-only">Ações</span></TH>
                </tr>
              </THead>
              <TBody>
                {data.data.map((p) => {
                  const low = p.type === 'PRODUCT' && p.stock <= p.minStock;
                  return (
                    <TR key={p.id} className={cn(!p.active && 'opacity-60')}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                            {p.type === 'SERVICE' ? <Wrench className="size-4" /> : <Package className="size-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground"><span className="font-mono">{p.sku}</span> · {PRODUCT_TYPE_LABELS[p.type]}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="hidden md:table-cell">{p.category}</TD>
                      <TD className="text-right font-medium tabular">{formatCents(p.priceCents)}</TD>
                      <TD className="text-right tabular">
                        {p.type === 'SERVICE' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={cn('inline-flex items-center gap-1', low && 'font-semibold text-danger')}>
                            {low && <AlertTriangle className="size-3.5" aria-label="Estoque baixo" />}
                            {formatNumber(p.stock)}
                          </span>
                        )}
                      </TD>
                      <TD className="hidden sm:table-cell">
                        {p.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge dot>Inativo</Badge>}
                      </TD>
                      <TD>
                        {(can('products:write') || can('products:delete')) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${p.name}`}><MoreHorizontal /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {can('products:write') && <DropdownMenuItem onSelect={() => { setEditing(p); setFormOpen(true); }}><Pencil /> Editar</DropdownMenuItem>}
                              {can('products:delete') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem tone="danger" onSelect={() => setDeleting(p)}><Trash2 /> Excluir</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination meta={data.meta} onPageChange={(p) => setQ({ page: p }, false)} />
          </>
        )}
      </Card>

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir produto?"
        description={<>O item <strong className="text-foreground">{deleting?.name}</strong> será removido. Itens já vendidos não podem ser excluídos — desative-os.</>}
        confirmLabel="Excluir produto"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </>
  );
}
