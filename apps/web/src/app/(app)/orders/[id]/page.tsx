'use client';

import {
  CUSTOMER_TYPE_LABELS,
  FINANCIAL_TYPE_LABELS,
  formatDocument,
  isOrderEditable,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  type OrderStatus,
} from '@horizons/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, CircleDollarSign, Clock, Loader, Pencil, RotateCcw, Send, Trash2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { FinancialStatusBadge, OrderStatusBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Textarea } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { useDeleteMutation } from '@/hooks/use-delete';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatCents, formatDateOnly, formatDateTime } from '@/lib/format';
import type { Order, Single } from '@/lib/types';
import { cn } from '@/lib/utils';

const ACTIONS: Record<OrderStatus, { label: string; icon: LucideIcon; description: string }> = {
  AWAITING_PAYMENT: { label: 'Enviar para pagamento', icon: Send, description: 'O estoque dos produtos será reservado e uma conta a receber será gerada no financeiro.' },
  PAID: { label: 'Confirmar pagamento', icon: CircleDollarSign, description: 'A conta a receber será baixada como paga e a venda passará a contar no faturamento.' },
  PROCESSING: { label: 'Iniciar processamento', icon: Loader, description: 'O pedido passará para a etapa de separação/execução.' },
  COMPLETED: { label: 'Concluir pedido', icon: CheckCircle2, description: 'Pedidos concluídos não podem mais ser alterados ou cancelados.' },
  QUOTE: { label: 'Voltar para orçamento', icon: RotateCcw, description: 'O estoque reservado será devolvido e a cobrança pendente será cancelada.' },
  CANCELED: { label: 'Cancelar pedido', icon: Ban, description: 'O estoque será devolvido. Se o pedido já foi pago, o estorno será registrado como despesa. Esta ação não pode ser desfeita.' },
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [pending, setPending] = React.useState<OrderStatus | null>(null);
  const [note, setNote] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<Single<Order>>(`/orders/${id}`).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => api<Single<Order>>(`/orders/${id}/status`, { method: 'PATCH', body: { status, note } }),
    onSuccess: (res) => {
      queryClient.setQueryData(['order', id], res.data);
      toast.success(`Pedido atualizado para "${ORDER_STATUS_LABELS[res.data.status]}".`);
      for (const key of ['orders', 'dashboard', 'products', 'finance', 'notifications']) queryClient.invalidateQueries({ queryKey: [key] });
      setPending(null);
      setNote('');
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setPending(null);
    },
  });

  const del = useDeleteMutation({
    path: (oid) => `/orders/${oid}`,
    invalidate: [['orders'], ['dashboard']],
    success: 'Orçamento excluído.',
    onDone: () => router.replace('/orders'),
    onSettled: () => setConfirmDelete(false),
  });

  if (isLoading) return <Skeleton className="h-[480px] rounded-xl" />;
  if (error || !order) {
    return <Card><ErrorState message={error instanceof ApiError && error.status === 404 ? 'Pedido não encontrado.' : errorMessage(error)} onRetry={() => refetch()} /></Card>;
  }

  const transitions = ORDER_TRANSITIONS[order.status].filter((s) => (s === 'CANCELED' ? can('orders:cancel') : can('orders:status')));
  const forward = transitions.filter((s) => s !== 'CANCELED' && s !== 'QUOTE');
  const secondary = transitions.filter((s) => s === 'QUOTE' || s === 'CANCELED');
  const editable = isOrderEditable(order.status) && can('orders:write');

  return (
    <>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Pedidos
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{order.code}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Criado em {formatDateTime(order.createdAt)}{order.createdBy && ` por ${order.createdBy.name}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === 'QUOTE' && can('orders:write') && (
            <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}><Trash2 /> Excluir</Button>
          )}
          {secondary.map((s) => {
            const A = ACTIONS[s];
            return (
              <Button key={s} variant={s === 'CANCELED' ? 'danger-ghost' : 'secondary'} onClick={() => setPending(s)}>
                <A.icon /> {A.label}
              </Button>
            );
          })}
          {editable && (
            <Button asChild variant="secondary"><Link href={`/orders/${order.id}/edit`}><Pencil /> Editar</Link></Button>
          )}
          {forward.map((s) => {
            const A = ACTIONS[s];
            return <Button key={s} onClick={() => setPending(s)}><A.icon /> {A.label}</Button>;
          })}
        </div>
      </div>

      {(order.status === 'COMPLETED' || order.status === 'CANCELED') && (
        <div className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Este pedido está <strong className="text-foreground">{ORDER_STATUS_LABELS[order.status].toLowerCase()}</strong> e não aceita mais alterações.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Itens</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <THead>
                  <tr>
                    <TH>Produto</TH>
                    <TH className="text-right">Qtd.</TH>
                    <TH className="hidden text-right sm:table-cell">Valor unit.</TH>
                    <TH className="hidden text-right sm:table-cell">Desconto</TH>
                    <TH className="text-right">Total</TH>
                  </tr>
                </THead>
                <TBody>
                  {order.items.map((i) => (
                    <TR key={i.id}>
                      <TD>
                        <p className="font-medium">{i.productName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{i.productSku}</p>
                      </TD>
                      <TD className="text-right tabular">{i.quantity}</TD>
                      <TD className="hidden text-right tabular sm:table-cell">{formatCents(i.unitPriceCents)}</TD>
                      <TD className="hidden text-right tabular text-muted-foreground sm:table-cell">{i.discountCents ? `− ${formatCents(i.discountCents)}` : '—'}</TD>
                      <TD className="text-right font-medium tabular">{formatCents(i.totalCents)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <dl className="space-y-2 border-t border-border px-5 py-4 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{formatCents(order.subtotalCents)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Desconto do pedido</dt><dd className="tabular">{order.discountCents ? `− ${formatCents(order.discountCents)}` : '—'}</dd></div>
                <div className="flex items-baseline justify-between border-t border-border pt-2">
                  <dt className="font-medium">Total</dt>
                  <dd className="text-xl font-semibold tabular">{formatCents(order.totalCents)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-line">{order.notes}</p></CardContent>
            </Card>
          )}

          {can('finance:read') && (
            <Card>
              <CardHeader><CardTitle>Lançamentos financeiros</CardTitle></CardHeader>
              <CardContent className="px-0 pb-0">
                {order.financialEntries.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhum lançamento. A conta a receber é gerada quando o pedido é enviado para pagamento.</p>
                ) : (
                  <Table>
                    <THead><tr><TH>Descrição</TH><TH>Vencimento</TH><TH>Status</TH><TH className="text-right">Valor</TH></tr></THead>
                    <TBody>
                      {order.financialEntries.map((f) => (
                        <TR key={f.id}>
                          <TD>
                            <p>{f.description}</p>
                            <p className="text-xs text-muted-foreground">{FINANCIAL_TYPE_LABELS[f.type]}</p>
                          </TD>
                          <TD className="tabular">{formatDateOnly(f.dueDate)}</TD>
                          <TD><FinancialStatusBadge status={f.status} /></TD>
                          <TD className={cn('text-right font-medium tabular', f.type === 'EXPENSE' && 'text-danger')}>
                            {f.type === 'EXPENSE' ? '− ' : ''}{formatCents(f.amountCents)}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Link href={`/customers/${order.customer.id}`} className="font-medium hover:text-primary">{order.customer.name}</Link>
              <p className="text-muted-foreground">{CUSTOMER_TYPE_LABELS[order.customer.type]}{order.customer.document && ` · ${formatDocument(order.customer.document)}`}</p>
              {order.customer.email && <p className="text-muted-foreground">{order.customer.email}</p>}
              {order.customer.phone && <p className="text-muted-foreground">{order.customer.phone}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-border">
                {order.statusHistory.map((h) => (
                  <li key={h.id} className="relative pl-8">
                    <span className="absolute top-0.5 left-0 grid size-[19px] place-items-center rounded-full bg-card ring-1 ring-border">
                      <Clock className="size-3 text-muted-foreground" aria-hidden />
                    </span>
                    <OrderStatusBadge status={h.toStatus} />
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}{h.user && ` · ${h.user.name}`}</p>
                    {h.note && <p className="mt-1 text-sm">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => { if (!o) { setPending(null); setNote(''); } }}
        title={pending ? `${ACTIONS[pending].label}?` : ''}
        tone={pending === 'CANCELED' ? 'danger' : 'primary'}
        confirmLabel={pending ? ACTIONS[pending].label : 'Confirmar'}
        loading={statusMutation.isPending}
        onConfirm={() => pending && statusMutation.mutate(pending)}
        description={
          <div className="space-y-3">
            <p>{pending && ACTIONS[pending].description}</p>
            <div>
              <label htmlFor="status-note" className="mb-1 block text-xs font-medium text-foreground">Observação (opcional)</label>
              <Textarea id="status-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir orçamento?"
        description="O orçamento será removido permanentemente."
        confirmLabel="Excluir"
        loading={del.isPending}
        onConfirm={() => del.mutate(order.id)}
      />
    </>
  );
}
