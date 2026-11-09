'use client';

import { CUSTOMER_TYPE_LABELS, formatDocument, type CustomerType } from '@horizons/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Building2, Eye, MoreHorizontal, Pencil, Plus, Trash2, User, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { CustomerFormDialog } from '@/features/customers/customer-form-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useDeleteMutation } from '@/hooks/use-delete';
import { useUrlState } from '@/hooks/use-url-state';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import type { Customer, Paginated } from '@/lib/types';

export function CustomersView() {
  const { can } = useAuth();
  const router = useRouter();
  const [q, setQ] = useUrlState(['search', 'type', 'sort', 'page'] as const);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | undefined>();
  const [deleting, setDeleting] = React.useState<Customer | null>(null);

  const sort = q.sort || 'createdAt:desc';
  const [sortField, sortOrder] = sort.split(':');
  const params = { search: q.search, type: q.type, page: q.page || 1, pageSize: 15, sort: sortField, order: sortOrder };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['customers', params],
    queryFn: () => api<Paginated<Customer>>('/customers', { query: params }),
    placeholderData: keepPreviousData,
  });

  const del = useDeleteMutation({
    path: (id) => `/customers/${id}`,
    invalidate: [['customers'], ['dashboard']],
    success: 'Cliente excluído.',
    onSettled: () => setDeleting(null),
  });

  const hasFilters = Boolean(q.search || q.type);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastre e acompanhe sua carteira de clientes."
        actions={
          can('customers:write') && (
            <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}>
              <Plus /> Novo cliente
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput className="sm:max-w-xs sm:flex-1" value={q.search} onChange={(v) => setQ({ search: v })} placeholder="Nome, e-mail, documento ou cidade" />
          <div className="flex gap-2">
            <Select aria-label="Filtrar por tipo" className="sm:w-44" value={q.type} onChange={(e) => setQ({ type: e.target.value })}>
              <option value="">Todos os tipos</option>
              <option value="INDIVIDUAL">Pessoa física</option>
              <option value="COMPANY">Pessoa jurídica</option>
            </Select>
            <Select aria-label="Ordenar" className="sm:w-48" value={sort} onChange={(e) => setQ({ sort: e.target.value === 'createdAt:desc' ? null : e.target.value })}>
              <option value="createdAt:desc">Mais recentes</option>
              <option value="createdAt:asc">Mais antigos</option>
              <option value="name:asc">Nome (A–Z)</option>
              <option value="name:desc">Nome (Z–A)</option>
            </Select>
          </div>
          {isFetching && !isLoading && <span className="text-xs text-muted-foreground sm:ml-auto">Atualizando…</span>}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : !data?.data.length ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            description={hasFilters ? 'Ajuste a pesquisa ou os filtros.' : 'Cadastre seu primeiro cliente para começar a registrar pedidos.'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => setQ({ search: null, type: null })}>Limpar filtros</Button>
              ) : can('customers:write') ? (
                <Button onClick={() => setFormOpen(true)}><Plus /> Novo cliente</Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Cliente</TH>
                  <TH className="hidden md:table-cell">Contato</TH>
                  <TH className="hidden lg:table-cell">Cidade</TH>
                  <TH className="text-right">Pedidos</TH>
                  <TH className="hidden sm:table-cell">Cadastro</TH>
                  <TH className="w-12"><span className="sr-only">Ações</span></TH>
                </tr>
              </THead>
              <TBody>
                {data.data.map((c) => (
                  <TR key={c.id} className="cursor-pointer" onClick={() => router.push(`/customers/${c.id}`)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                          {c.type === 'COMPANY' ? <Building2 className="size-4" /> : <User className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <Link href={`/customers/${c.id}`} className="block truncate font-medium hover:text-primary" onClick={(e) => e.stopPropagation()}>
                            {c.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {CUSTOMER_TYPE_LABELS[c.type as CustomerType]}
                            {c.document && <> · <span className="font-mono">{formatDocument(c.document)}</span></>}
                          </p>
                        </div>
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <p className="truncate">{c.email ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{c.phone ?? ''}</p>
                    </TD>
                    <TD className="hidden lg:table-cell">{c.city ? `${c.city}${c.state ? `/${c.state}` : ''}` : '—'}</TD>
                    <TD className="text-right tabular">
                      {c.ordersCount ? <Badge tone="primary">{formatNumber(c.ordersCount)}</Badge> : <span className="text-muted-foreground">0</span>}
                    </TD>
                    <TD className="hidden text-muted-foreground sm:table-cell">{formatDate(c.createdAt)}</TD>
                    <TD onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${c.name}`}><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => router.push(`/customers/${c.id}`)}><Eye /> Ver detalhes</DropdownMenuItem>
                          {can('customers:write') && (
                            <DropdownMenuItem onSelect={() => { setEditing(c); setFormOpen(true); }}><Pencil /> Editar</DropdownMenuItem>
                          )}
                          {can('customers:delete') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem tone="danger" onSelect={() => setDeleting(c)}><Trash2 /> Excluir</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination meta={data.meta} onPageChange={(p) => setQ({ page: p }, false)} />
          </>
        )}
      </Card>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={editing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir cliente?"
        description={<>O cliente <strong className="text-foreground">{deleting?.name}</strong> será removido permanentemente. Clientes com pedidos não podem ser excluídos.</>}
        confirmLabel="Excluir cliente"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </>
  );
}
