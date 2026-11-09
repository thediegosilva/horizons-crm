'use client';

import { CUSTOMER_TYPE_LABELS, type CustomerType, type OrderStatus, type ReportType } from '@horizons/shared';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import * as React from 'react';
import { ColumnChart, Legend, RankingBars, TrendAreaChart } from '@/components/charts/charts';
import { OrderStatusBadge } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useUrlState } from '@/hooks/use-url-state';
import { api, buildQuery, errorMessage } from '@/lib/api';
import { formatCents, formatAxisCents, formatDate, formatNumber, formatPeriod, shiftDate, todayIso } from '@/lib/format';

const REPORTS: { type: ReportType; label: string; description: string }[] = [
  { type: 'sales', label: 'Vendas por período', description: 'Pedidos pagos e faturamento agrupados por período (data do pagamento).' },
  { type: 'customers', label: 'Clientes cadastrados', description: 'Novos clientes cadastrados no período.' },
  { type: 'top-products', label: 'Produtos mais vendidos', description: 'Ranking por quantidade vendida em pedidos pagos.' },
  { type: 'revenue', label: 'Faturamento', description: 'Receitas e despesas pagas (regime de caixa) e resultado.' },
  { type: 'orders-by-status', label: 'Pedidos por status', description: 'Distribuição dos pedidos criados no período.' },
];

function presets() {
  const today = todayIso();
  return [
    { key: 'month', label: 'Este mês', from: `${today.slice(0, 7)}-01`, to: today },
    { key: '30d', label: 'Últimos 30 dias', from: shiftDate(today, -29), to: today },
    { key: '90d', label: 'Últimos 90 dias', from: shiftDate(today, -89), to: today },
    { key: 'year', label: 'Este ano', from: `${today.slice(0, 4)}-01-01`, to: today },
    { key: '12m', label: 'Últimos 12 meses', from: shiftDate(today, -364), to: today },
  ];
}

export function ReportsView() {
  const [q, setQ] = useUrlState(['tab', 'from', 'to', 'groupBy'] as const);
  const ps = React.useMemo(() => presets(), []);
  const tab = (REPORTS.find((r) => r.type === q.tab)?.type ?? 'sales') as ReportType;
  const from = q.from || ps[2]!.from;
  const to = q.to || ps[2]!.to;
  const groupBy = (q.groupBy || 'month') as 'day' | 'month';
  const params = { from, to, groupBy };
  const activePreset = ps.find((p) => p.from === from && p.to === to)?.key ?? 'custom';
  const report = REPORTS.find((r) => r.type === tab)!;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Analise o desempenho do negócio e exporte os dados em CSV."
        actions={
          <Button asChild variant="secondary">
            <a href={`/api/reports/${tab}/export${buildQuery(params)}`} download>
              <Download /> Exportar CSV
            </a>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="preset" className="text-xs font-medium text-muted-foreground">Período</label>
            <Select
              id="preset"
              className="lg:w-48"
              value={activePreset}
              onChange={(e) => {
                const p = ps.find((x) => x.key === e.target.value);
                if (p) setQ({ from: p.from, to: p.to });
              }}
            >
              {ps.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              <option value="custom" disabled>Personalizado</option>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="from" className="text-xs font-medium text-muted-foreground">De</label>
              <Input id="from" type="date" value={from} max={to} onChange={(e) => e.target.value && setQ({ from: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="to" className="text-xs font-medium text-muted-foreground">Até</label>
              <Input id="to" type="date" value={to} min={from} onChange={(e) => e.target.value && setQ({ to: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="groupBy" className="text-xs font-medium text-muted-foreground">Agrupar por</label>
            <Select id="groupBy" className="lg:w-36" value={groupBy} onChange={(e) => setQ({ groupBy: e.target.value })}>
              <option value="day">Dia</option>
              <option value="month">Mês</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setQ({ tab: v })}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            {REPORTS.map((r) => <TabsTrigger key={r.type} value={r.type}>{r.label}</TabsTrigger>)}
          </TabsList>
        </div>
        {REPORTS.map((r) => (
          <TabsContent key={r.type} value={r.type}>
            {r.type === tab && <ReportPanel type={tab} params={params} title={report.label} description={report.description} />}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

type SalesData = { series: { period: string; orders: number; revenueCents: number; discountCents: number; averageTicketCents: number }[]; totals: { orders: number; revenueCents: number; averageTicketCents: number } };
type CustomersData = { series: { period: string; count: number }[]; rows: { id: string; name: string; type: CustomerType; email: string | null; city: string | null; state: string | null; createdAt: string; ordersCount: number }[]; totals: { count: number } };
type TopData = { rows: { productId: string; name: string; sku: string; quantity: number; revenueCents: number; orders: number }[] };
type RevenueData = { series: { period: string; incomeCents: number; expenseCents: number; resultCents: number }[]; totals: { incomeCents: number; expenseCents: number; resultCents: number } };
type StatusData = { rows: { status: OrderStatus; label: string; count: number; totalCents: number }[]; totals: { count: number } };

function ReportPanel({ type, params, title, description }: { type: ReportType; params: Record<string, string>; title: string; description: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['report', type, params],
    queryFn: () => api<{ data: unknown }>(`/reports/${type}`, { query: params }).then((r) => r.data),
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72" />
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : (
          <ReportBody type={type} data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function Totals({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="mb-5 grid gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const empty = <EmptyState icon={BarChart3} title="Sem dados no período" description="Altere o período para visualizar resultados." />;

function ReportBody({ type, data }: { type: ReportType; data: unknown }) {
  if (type === 'sales') {
    const d = data as SalesData;
    if (!d.series.length) return empty;
    return (
      <>
        <Totals items={[
          { label: 'Pedidos pagos', value: formatNumber(d.totals.orders) },
          { label: 'Faturamento', value: formatCents(d.totals.revenueCents) },
          { label: 'Ticket médio', value: formatCents(d.totals.averageTicketCents) },
        ]} />
        <TrendAreaChart data={d.series} xKey="period" caption="Faturamento por período" series={[{ key: 'revenueCents', label: 'Faturamento', color: 'var(--chart-1)', format: formatCents }]} tickFormat={formatPeriod} yFormat={formatAxisCents} />
        <Table className="mt-4">
          <THead><tr><TH>Período</TH><TH className="text-right">Pedidos</TH><TH className="text-right">Descontos</TH><TH className="text-right">Ticket médio</TH><TH className="text-right">Faturamento</TH></tr></THead>
          <TBody>
            {d.series.map((r) => (
              <TR key={r.period}>
                <TD>{formatPeriod(r.period)}</TD>
                <TD className="text-right tabular">{formatNumber(r.orders)}</TD>
                <TD className="text-right tabular text-muted-foreground">{formatCents(r.discountCents)}</TD>
                <TD className="text-right tabular">{formatCents(r.averageTicketCents)}</TD>
                <TD className="text-right font-medium tabular">{formatCents(r.revenueCents)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </>
    );
  }
  if (type === 'customers') {
    const d = data as CustomersData;
    if (!d.rows.length) return empty;
    return (
      <>
        <Totals items={[{ label: 'Novos clientes', value: formatNumber(d.totals.count) }]} />
        <ColumnChart data={d.series} xKey="period" caption="Novos clientes por período" series={[{ key: 'count', label: 'Novos clientes', color: 'var(--chart-1)', format: formatNumber }]} tickFormat={formatPeriod} yFormat={formatNumber} height={200} />
        <Table className="mt-4">
          <THead><tr><TH>Cliente</TH><TH>Tipo</TH><TH className="hidden md:table-cell">E-mail</TH><TH className="hidden md:table-cell">Cidade</TH><TH className="text-right">Pedidos</TH><TH>Cadastro</TH></tr></THead>
          <TBody>
            {d.rows.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.name}</TD>
                <TD>{CUSTOMER_TYPE_LABELS[c.type]}</TD>
                <TD className="hidden md:table-cell">{c.email ?? '—'}</TD>
                <TD className="hidden md:table-cell">{c.city ? `${c.city}/${c.state ?? ''}` : '—'}</TD>
                <TD className="text-right tabular">{c.ordersCount}</TD>
                <TD className="tabular">{formatDate(c.createdAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </>
    );
  }
  if (type === 'top-products') {
    const d = data as TopData;
    if (!d.rows.length) return empty;
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <RankingBars rows={d.rows.slice(0, 10).map((r) => ({ label: r.name, sublabel: r.sku, value: r.quantity }))} format={(v) => `${formatNumber(v)} un.`} />
        <Table>
          <THead><tr><TH>Produto</TH><TH className="text-right">Qtd.</TH><TH className="text-right">Pedidos</TH><TH className="text-right">Faturamento</TH></tr></THead>
          <TBody>
            {d.rows.map((r) => (
              <TR key={r.productId}>
                <TD><p className="font-medium">{r.name}</p><p className="font-mono text-xs text-muted-foreground">{r.sku}</p></TD>
                <TD className="text-right tabular">{formatNumber(r.quantity)}</TD>
                <TD className="text-right tabular">{formatNumber(r.orders)}</TD>
                <TD className="text-right font-medium tabular">{formatCents(r.revenueCents)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    );
  }
  if (type === 'revenue') {
    const d = data as RevenueData;
    if (!d.series.length) return empty;
    const series = [
      { key: 'incomeCents' as const, label: 'Receitas', color: 'var(--chart-1)', format: formatCents },
      { key: 'expenseCents' as const, label: 'Despesas', color: 'var(--chart-2)', format: formatCents },
    ];
    return (
      <>
        <Totals items={[
          { label: 'Receitas', value: formatCents(d.totals.incomeCents) },
          { label: 'Despesas', value: formatCents(d.totals.expenseCents) },
          { label: 'Resultado', value: formatCents(d.totals.resultCents) },
        ]} />
        <div className="mb-3 flex justify-end"><Legend series={series} /></div>
        <ColumnChart data={d.series} xKey="period" caption="Receitas e despesas por período" series={series} tickFormat={formatPeriod} yFormat={formatAxisCents} />
        <Table className="mt-4">
          <THead><tr><TH>Período</TH><TH className="text-right">Receitas</TH><TH className="text-right">Despesas</TH><TH className="text-right">Resultado</TH></tr></THead>
          <TBody>
            {d.series.map((r) => (
              <TR key={r.period}>
                <TD>{formatPeriod(r.period)}</TD>
                <TD className="text-right tabular">{formatCents(r.incomeCents)}</TD>
                <TD className="text-right tabular">{formatCents(r.expenseCents)}</TD>
                <TD className={`text-right font-medium tabular ${r.resultCents < 0 ? 'text-danger' : ''}`}>{formatCents(r.resultCents)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </>
    );
  }
  const d = data as StatusData;
  if (!d.totals.count) return empty;
  const max = Math.max(...d.rows.map((r) => r.count), 1);
  return (
    <Table>
      <THead><tr><TH>Status</TH><TH className="w-1/3">Distribuição</TH><TH className="text-right">Pedidos</TH><TH className="text-right">Valor total</TH></tr></THead>
      <TBody>
        {d.rows.map((r) => (
          <TR key={r.status}>
            <TD><OrderStatusBadge status={r.status} /></TD>
            <TD>
              <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-chart-1" style={{ width: `${(r.count / max) * 100}%` }} /></div>
            </TD>
            <TD className="text-right tabular">{formatNumber(r.count)} <span className="text-xs text-muted-foreground">({((r.count / d.totals.count) * 100).toFixed(0)}%)</span></TD>
            <TD className="text-right font-medium tabular">{formatCents(r.totalCents)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
