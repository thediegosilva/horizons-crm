'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Scale,
  Trash2,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';
import { ColumnChart, Legend } from '@/components/charts/charts';
import { StatCard } from '@/components/stat-card';
import { FinancialStatusBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { PageHeader, SearchInput } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EntryFormDialog } from '@/features/finance/entry-form-dialog';
import { useAuth } from '@/hooks/use-auth';
import { useUrlState } from '@/hooks/use-url-state';
import { api, errorMessage } from '@/lib/api';
import { formatCents, formatAxisCents, formatDateOnly, formatMonth, formatOrderNumber, todayIso } from '@/lib/format';
import type { FinanceSummary, FinancialEntry, Paginated } from '@/lib/types';
import { cn } from '@/lib/utils';

const VIEWS = [
  { key: '', label: 'Todos', query: {} },
  { key: 'income', label: 'Receitas', query: { type: 'INCOME' } },
  { key: 'expense', label: 'Despesas', query: { type: 'EXPENSE' } },
  { key: 'receivable', label: 'Contas a receber', query: { type: 'INCOME', status: 'PENDING' } },
  { key: 'payable', label: 'Contas a pagar', query: { type: 'EXPENSE', status: 'PENDING' } },
  { key: 'paid', label: 'Pagas', query: { status: 'PAID' } },
  { key: 'overdue', label: 'Vencidas', query: { overdue: 'true' } },
] as const;

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function FinanceView() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useUrlState(['view', 'type', 'status', 'overdue', 'month', 'search', 'page'] as const);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FinancialEntry | undefined>();
  const [defaultType, setDefaultType] = React.useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [action, setAction] = React.useState<{ kind: 'pay' | 'cancel' | 'delete'; entry: FinancialEntry } | null>(null);

  // Atalhos vindos do dashboard (?type=INCOME&status=PENDING, ?overdue=true)
  const legacyView = q.overdue === 'true' ? 'overdue' : q.type === 'INCOME' && q.status === 'PENDING' ? 'receivable' : '';
  const viewKey = q.view || legacyView;
  const view = VIEWS.find((v) => v.key === viewKey) ?? VIEWS[0];
  const month = q.month || todayIso().slice(0, 7);
  const period = monthBounds(month);

  const summary = useQuery({
    queryKey: ['finance', 'summary', period],
    queryFn: () => api<{ data: FinanceSummary }>('/finance/summary', { query: period }).then((r) => r.data),
  });
  const cashflow = useQuery({
    queryKey: ['finance', 'cashflow'],
    queryFn: () => api<{ data: { month: string; incomeCents: number; expenseCents: number }[] }>('/finance/cashflow').then((r) => r.data),
  });
  const listParams = { ...view.query, search: q.search, page: q.page || 1, pageSize: 15 };
  const entries = useQuery({
    queryKey: ['finance', 'entries', listParams],
    queryFn: () => api<Paginated<FinancialEntry>>('/finance/entries', { query: listParams }),
    placeholderData: keepPreviousData,
  });

  const mutate = useMutation({
    mutationFn: ({ kind, entry }: { kind: 'pay' | 'cancel' | 'delete'; entry: FinancialEntry }) =>
      kind === 'delete'
        ? api(`/finance/entries/${entry.id}`, { method: 'DELETE' })
        : api(`/finance/entries/${entry.id}/${kind}`, { method: 'POST', body: {} }),
    onSuccess: (_d, v) => {
      toast.success({ pay: 'Lançamento baixado como pago.', cancel: 'Lançamento cancelado.', delete: 'Lançamento excluído.' }[v.kind]);
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setAction(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setAction(null);
    },
  });

  // Preenche os 12 meses para um eixo contínuo.
  const flow = React.useMemo(() => {
    const map = new Map((cashflow.data ?? []).map((r) => [r.month, r]));
    const current = todayIso().slice(0, 7);
    return Array.from({ length: 12 }, (_, i) => {
      const m = shiftMonth(current, i - 11);
      return { month: m, incomeCents: map.get(m)?.incomeCents ?? 0, expenseCents: map.get(m)?.expenseCents ?? 0 };
    });
  }, [cashflow.data]);
  const flowSeries = [
    { key: 'incomeCents' as const, label: 'Receitas', color: 'var(--chart-1)', format: formatCents },
    { key: 'expenseCents' as const, label: 'Despesas', color: 'var(--chart-2)', format: formatCents },
  ];

  const s = summary.data;
  const rawMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  const monthLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas, contas a receber e a pagar."
        actions={
          can('finance:write') && (
            <>
              <Button variant="secondary" onClick={() => { setEditing(undefined); setDefaultType('INCOME'); setFormOpen(true); }}><ArrowUpCircle /> Nova receita</Button>
              <Button onClick={() => { setEditing(undefined); setDefaultType('EXPENSE'); setFormOpen(true); }}><Plus /> Nova despesa</Button>
            </>
          )
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" size="icon-sm" aria-label="Mês anterior" onClick={() => setQ({ month: shiftMonth(month, -1) }, false)}><ChevronLeft /></Button>
        <p className="min-w-40 text-center text-sm font-semibold" aria-live="polite">{monthLabel}</p>
        <Button variant="secondary" size="icon-sm" aria-label="Próximo mês" onClick={() => setQ({ month: shiftMonth(month, 1) }, false)}><ChevronRight /></Button>
        {q.month && <Button variant="ghost" size="sm" onClick={() => setQ({ month: null }, false)}>Mês atual</Button>}
      </div>

      {summary.isLoading || !s ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[126px] rounded-xl" />)}</div>
      ) : (
        <section aria-label="Resumo financeiro" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Receitas recebidas" value={formatCents(s.incomeCents)} icon={ArrowUpCircle} hint="Pagas no mês selecionado" />
          <StatCard label="Despesas pagas" value={formatCents(s.expenseCents)} icon={ArrowDownCircle} hint="Pagas no mês selecionado" />
          <StatCard
            label="Resultado do mês"
            value={formatCents(s.resultCents)}
            icon={Scale}
            tone={s.resultCents < 0 ? 'danger' : 'default'}
            hint={<span>Saldo acumulado: <strong className="text-foreground">{formatCents(s.balanceCents)}</strong></span>}
          />
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">Pendências</p>
              <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary"><Landmark className="size-[18px]" /></span>
            </div>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">A receber</dt>
                <dd className="font-semibold tabular">{formatCents(s.receivable.cents)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">A pagar</dt>
                <dd className="font-semibold tabular">{formatCents(s.payable.cents)}</dd>
              </div>
              {s.receivable.overdueCount + s.payable.overdueCount > 0 && (
                <button className="text-xs font-medium text-danger hover:underline" onClick={() => setQ({ view: 'overdue', type: null, status: null, overdue: null })}>
                  {s.receivable.overdueCount + s.payable.overdueCount} lançamento(s) vencido(s)
                </button>
              )}
            </dl>
          </Card>
        </section>
      )}

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Fluxo de caixa</CardTitle>
            <CardDescription>Receitas e despesas pagas, em R$ · últimos 12 meses</CardDescription>
          </div>
          <Legend series={flowSeries} />
        </CardHeader>
        <CardContent className="pt-3">
          {cashflow.isLoading ? (
            <Skeleton className="h-60" />
          ) : (
            <ColumnChart
              data={flow}
              xKey="month"
              series={flowSeries}
              caption="Receitas e despesas pagas por mês"
              tickFormat={(m) => formatMonth(m)}
              labelFormat={(m) => formatMonth(m, true)}
              yFormat={formatAxisCents}
            />
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 overflow-x-auto px-1">
            <div role="tablist" aria-label="Filtrar lançamentos" className="inline-flex gap-1 rounded-lg bg-muted p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={view.key === v.key}
                  onClick={() => setQ({ view: v.key, type: null, status: null, overdue: null })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all',
                    view.key === v.key ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <SearchInput className="lg:w-64" value={q.search} onChange={(v) => setQ({ search: v })} placeholder="Descrição ou categoria" />
        </div>

        {entries.isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : entries.error ? (
          <ErrorState message={errorMessage(entries.error)} onRetry={() => entries.refetch()} />
        ) : !entries.data?.data.length ? (
          <EmptyState icon={Wallet} title="Nenhum lançamento encontrado" description="Não há lançamentos para este filtro." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <TH>Descrição</TH>
                  <TH className="hidden md:table-cell">Categoria</TH>
                  <TH>Vencimento</TH>
                  <TH className="hidden sm:table-cell">Status</TH>
                  <TH className="text-right">Valor</TH>
                  <TH className="w-12"><span className="sr-only">Ações</span></TH>
                </tr>
              </THead>
              <TBody>
                {entries.data.data.map((e) => (
                  <TR key={e.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        {e.type === 'INCOME'
                          ? <ArrowUpCircle className="size-4 shrink-0 text-success" aria-label="Receita" />
                          : <ArrowDownCircle className="size-4 shrink-0 text-danger" aria-label="Despesa" />}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.description}</p>
                          {e.order && (
                            <Link href={`/orders/${e.order.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <Lock className="size-3" aria-hidden /> {formatOrderNumber(e.order.number)}
                            </Link>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell text-muted-foreground">{e.category}</TD>
                    <TD className="tabular">
                      {formatDateOnly(e.dueDate)}
                      {e.paidAt && <p className="text-xs text-muted-foreground">Pago em {formatDateOnly(e.paidAt)}</p>}
                    </TD>
                    <TD className="hidden sm:table-cell"><FinancialStatusBadge status={e.status} overdue={e.overdue} /></TD>
                    <TD className={cn('text-right font-semibold tabular', e.type === 'EXPENSE' ? 'text-danger' : 'text-success', e.status === 'CANCELED' && 'line-through opacity-60')}>
                      {e.type === 'EXPENSE' ? '−' : '+'} {formatCents(e.amountCents)}
                    </TD>
                    <TD>
                      {can('finance:write') && !e.locked && e.status !== 'CANCELED' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Ações para ${e.description}`}><MoreHorizontal /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {e.status === 'PENDING' && (
                              <>
                                <DropdownMenuItem onSelect={() => setAction({ kind: 'pay', entry: e })}><CheckCircle2 /> Marcar como pago</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => { setEditing(e); setFormOpen(true); }}><Pencil /> Editar</DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onSelect={() => setAction({ kind: 'cancel', entry: e })}><Ban /> Cancelar lançamento</DropdownMenuItem>
                            {e.status === 'PENDING' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem tone="danger" onSelect={() => setAction({ kind: 'delete', entry: e })}><Trash2 /> Excluir</DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination meta={entries.data.meta} onPageChange={(p) => setQ({ page: p }, false)} />
          </>
        )}
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <Lock className="mr-1 inline size-3" aria-hidden />Lançamentos de pedidos são atualizados automaticamente pelo status do pedido e não podem ser editados manualmente.
        </p>
      </Card>

      <EntryFormDialog open={formOpen} onOpenChange={setFormOpen} entry={editing} defaultType={defaultType} />
      <ConfirmDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        tone={action?.kind === 'pay' ? 'primary' : 'danger'}
        title={action ? { pay: 'Marcar como pago?', cancel: 'Cancelar lançamento?', delete: 'Excluir lançamento?' }[action.kind] : ''}
        confirmLabel={action ? { pay: 'Confirmar pagamento', cancel: 'Cancelar lançamento', delete: 'Excluir' }[action.kind] : ''}
        description={
          action && (
            <>
              <strong className="text-foreground">{action.entry.description}</strong> — {formatCents(action.entry.amountCents)}.{' '}
              {action.kind === 'pay' && 'A data de pagamento será hoje.'}
              {action.kind === 'cancel' && 'O valor deixará de contar no saldo e nos relatórios.'}
              {action.kind === 'delete' && 'Esta ação não pode ser desfeita.'}
            </>
          )
        }
        loading={mutate.isPending}
        onConfirm={() => action && mutate.mutate(action)}
      />
    </>
  );
}
