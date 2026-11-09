'use client';

import { CUSTOMER_TYPE_LABELS, formatDocument } from '@horizons/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Mail, MapPin, Pencil, Phone, Plus, ShoppingBag, StickyNote, Trash2, User } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Pagination } from '@/components/ui/pagination';
import { CustomerFormDialog } from '@/features/customers/customer-form-dialog';
import { OrdersTable } from '@/features/orders/orders-table';
import { useAuth } from '@/hooks/use-auth';
import { useDeleteMutation } from '@/hooks/use-delete';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatCents, formatDate, formatNumber } from '@/lib/format';
import type { Customer, OrderSummary, Paginated, Single } from '@/lib/types';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const { data: customer, isLoading, error, refetch } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api<Single<Customer>>(`/customers/${id}`).then((r) => r.data),
  });
  const orders = useQuery({
    queryKey: ['orders', { customerId: id, page }],
    queryFn: () => api<Paginated<OrderSummary>>('/orders', { query: { customerId: id, page, pageSize: 10 } }),
    enabled: !!customer,
  });
  const del = useDeleteMutation({
    path: (cid) => `/customers/${cid}`,
    invalidate: [['customers'], ['dashboard']],
    success: 'Cliente excluído.',
    onDone: () => router.replace('/customers'),
    onSettled: () => setConfirmDelete(false),
  });

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (error || !customer) {
    return (
      <Card>
        <ErrorState message={error instanceof ApiError && error.status === 404 ? 'Cliente não encontrado.' : errorMessage(error)} onRetry={() => refetch()} />
      </Card>
    );
  }

  const address = [
    [customer.street, customer.number].filter(Boolean).join(', '),
    customer.complement,
    customer.district,
    [customer.city, customer.state].filter(Boolean).join('/'),
    customer.zipCode?.replace(/(\d{5})(\d{3})/, '$1-$2'),
  ].filter(Boolean).join(' · ');

  return (
    <>
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-primary">
            {customer.type === 'COMPANY' ? <Building2 className="size-6" /> : <User className="size-6" />}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge>{CUSTOMER_TYPE_LABELS[customer.type]}</Badge>
              {customer.document && <span className="font-mono">{formatDocument(customer.document)}</span>}
              <span>· Cliente desde {formatDate(customer.createdAt)}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {can('customers:delete') && (
            <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}><Trash2 /> Excluir</Button>
          )}
          {can('customers:write') && (
            <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil /> Editar</Button>
          )}
          {can('orders:write') && (
            <Button asChild><Link href={`/orders/new?customerId=${customer.id}`}><Plus /> Novo pedido</Link></Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total comprado</p>
                <p className="mt-1 text-lg font-semibold tabular">{formatCents(customer.stats?.totalSpentCents ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="mt-1 text-lg font-semibold tabular">{formatNumber(customer.stats?.ordersCount ?? 0)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Último pedido</p>
                <p className="mt-1 text-sm font-medium">{formatDate(customer.stats?.lastOrderAt)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Dados de contato</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <InfoRow icon={Mail} label="E-mail" value={customer.email} />
                <InfoRow icon={Phone} label="Telefone" value={customer.phone} />
                <InfoRow icon={MapPin} label="Endereço" value={address || null} />
                <InfoRow icon={StickyNote} label="Observações" value={customer.notes} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Histórico de pedidos</CardTitle></CardHeader>
          <CardContent className="px-0 pb-0">
            {orders.isLoading ? (
              <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : orders.error ? (
              <ErrorState message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />
            ) : !orders.data?.data.length ? (
              <EmptyState icon={ShoppingBag} title="Nenhum pedido" description="Este cliente ainda não possui pedidos." />
            ) : (
              <>
                <OrdersTable orders={orders.data.data} showCustomer={false} />
                <Pagination meta={orders.data.meta} onPageChange={setPage} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir cliente?"
        description={<>Esta ação não pode ser desfeita. Clientes com pedidos não podem ser excluídos para preservar o histórico.</>}
        confirmLabel="Excluir cliente"
        loading={del.isPending}
        onConfirm={() => del.mutate(customer.id)}
      />
    </>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words">{value || <span className="text-muted-foreground">Não informado</span>}</dd>
      </div>
    </div>
  );
}
