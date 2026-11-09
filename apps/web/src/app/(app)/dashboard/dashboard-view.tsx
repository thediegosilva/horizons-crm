'use client';

import { ORDER_STATUS_LABELS, type OrderStatus } from '@horizons/shared';
import { useQuery } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CircleDollarSign,
  Clock,
  PackageX,
  Percent,
  Plus,
  Receipt,
  ShoppingBag,
  TrendingDown,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { ColumnChart, TrendAreaChart } from '@/components/charts/charts';
import { StatCard } from '@/components/stat-card';
import { OrderStatusBadge, ORDER_STATUS_TONES } from '@/components/status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/api';
import {
  formatCents,
  formatAxisCents,
  formatCompactCents,
  formatDateOnly,
  formatDateTime,
  formatMonth,
  formatNumber,
  formatPercent,
  relativeTime,
} from '@/lib/format';
import type { Dashboard } from '@/lib/types';
import { cn } from '@/lib/utils';

const toneBar: Record<string, string> = {
  neutral: 'bg-muted-foreground/50',
  warning: 'bg-warning',
  info: 'bg-info',
  primary: 'bg-primary',
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[126px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-[340px] rounded-xl xl:col-span-2" />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardView() {
  const { user, can } = useAuth();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<{ data: Dashboard }>('/dashboard').then((r) => r.data),
  });

  const firstName = user.name.split(' ')[0];
  const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description={`Resumo do seu negócio · ${today}`}
        actions={
          can('orders:write') && (
            <Button asChild>
              <Link href="/orders/new">
                <Plus /> Novo pedido
              </Link>
            </Button>
          )
        }
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <Card>
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        </Card>
      ) : (
        <DashboardContent data={data} />
      )}
    </>
  );
}

function DashboardContent({ data }: { data: Dashboard }) {
  const { can } = useAuth();
  const pendingStatuses: OrderStatus[] = ['QUOTE', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING'];
  const hasSales = data.monthly.some((m) => m.revenueCents > 0);

  return (
    <div className="space-y-6">
      <section aria-label="Indicadores principais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total de clientes"
          value={formatNumber(data.customers.total)}
          icon={Users}
          href="/customers"
          hint={<span>+{formatNumber(data.customers.newThisMonth)} neste mês</span>}
        />
        <StatCard
          label="Total de vendas"
          value={formatNumber(data.sales.total)}
          icon={ShoppingBag}
          href="/orders"
          hint={<span>{formatNumber(data.sales.thisMonth)} pagas neste mês</span>}
        />
        <StatCard
          label="Faturamento do mês"
          value={formatCents(data.revenue.monthCents)}
          icon={CircleDollarSign}
          change={data.revenue.changePct}
          hint={<span>vs. {formatCompactCents(data.revenue.previousMonthCents)} no mês anterior</span>}
        />
        <StatCard
          label="Pedidos pendentes"
          value={formatNumber(data.pendingOrders.total)}
          icon={Clock}
          href="/orders"
          hint={<span>{formatNumber(data.pendingOrders.byStatus.AWAITING_PAYMENT ?? 0)} aguardando pagamento</span>}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Evolução do faturamento</CardTitle>
              <CardDescription>Vendas pagas por mês, em R$ · últimos 12 meses</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {hasSales ? (
              <TrendAreaChart
                data={data.monthly}
                xKey="period"
                caption="Faturamento mensal dos últimos 12 meses"
                series={[{ key: 'revenueCents', label: 'Faturamento', color: 'var(--chart-1)', format: formatCents }]}
                tickFormat={(p) => formatMonth(p)}
                labelFormat={(p) => formatMonth(p, true)}
                yFormat={formatAxisCents}
                height={280}
              />
            ) : (
              <EmptyState icon={TrendingDown} title="Sem vendas pagas ainda" description="Quando um pedido for marcado como pago, o faturamento aparecerá aqui." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Indicadores de desempenho</CardTitle>
              <CardDescription>Pedidos criados nos últimos 90 dias</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border">
              <Kpi icon={Receipt} label="Ticket médio (mês)" value={formatCents(data.kpis.averageTicketCents)} />
              <Kpi icon={Percent} label="Taxa de conversão" value={formatPercent(data.kpis.conversionRatePct)} />
              <Kpi icon={TrendingDown} label="Taxa de cancelamento" value={formatPercent(data.kpis.cancellationRatePct)} />
              <Kpi
                icon={PackageX}
                label="Produtos com estoque baixo"
                value={formatNumber(data.kpis.lowStockProducts)}
                href={data.kpis.lowStockProducts > 0 ? '/products?lowStock=true' : undefined}
                alert={data.kpis.lowStockProducts > 0}
              />
              {data.finance && (
                <>
                  <Kpi icon={CircleDollarSign} label="Contas a receber" value={formatCents(data.finance.receivableCents)} href="/finance?type=INCOME&status=PENDING" />
                  <Kpi
                    icon={AlertTriangle}
                    label={`Recebimentos vencidos (${data.finance.overdueCount})`}
                    value={formatCents(data.finance.overdueCents)}
                    href={data.finance.overdueCount > 0 ? '/finance?overdue=true' : undefined}
                    alert={data.finance.overdueCount > 0}
                  />
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Vendas diárias</CardTitle>
              <CardDescription>Quantidade de pedidos pagos · últimos 30 dias</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <ColumnChart
              data={data.daily}
              xKey="period"
              caption="Pedidos pagos por dia nos últimos 30 dias"
              series={[{ key: 'orders', label: 'Pedidos pagos', color: 'var(--chart-1)', format: (v) => formatNumber(v) }]}
              tickFormat={(p) => p.slice(8, 10)}
              labelFormat={formatDateOnly}
              yFormat={(v) => formatNumber(v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pedidos em andamento</CardTitle>
              <CardDescription>{formatNumber(data.pendingOrders.total)} pedidos aguardando conclusão</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {pendingStatuses.map((status) => {
                const count = data.pendingOrders.byStatus[status] ?? 0;
                const pct = data.pendingOrders.total ? (count / data.pendingOrders.total) * 100 : 0;
                return (
                  <li key={status}>
                    <Link href={`/orders?status=${status}`} className="group block">
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground group-hover:text-foreground">{ORDER_STATUS_LABELS[status]}</span>
                        <span className="font-medium tabular">{formatNumber(count)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className={cn('h-2 rounded-full', toneBar[ORDER_STATUS_TONES[status]])} style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Pedidos recentes</CardTitle>
              <CardDescription>Últimos pedidos criados</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/orders">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {data.recentOrders.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title="Nenhum pedido ainda"
                description="Crie o primeiro pedido para começar a acompanhar suas vendas."
                action={can('orders:write') && <Button asChild size="sm"><Link href="/orders/new"><Plus /> Novo pedido</Link></Button>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{o.customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{o.code}</span> · {formatDateTime(o.createdAt)}
                        </p>
                      </div>
                      <OrderStatusBadge status={o.status} />
                      <span className="w-28 text-right text-sm font-semibold tabular">{formatCents(o.totalCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Últimas atividades</CardTitle>
              <CardDescription>Ações registradas na sua organização</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.activities.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="Sem atividades" description="As ações da equipe aparecerão aqui." />
            ) : (
              <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border">
                {data.activities.map((a) => (
                  <li key={a.id} className="relative pl-6">
                    <span className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-card bg-primary ring-1 ring-primary/30" aria-hidden />
                    <p className="text-sm">{a.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.userName ?? 'Sistema'} · <time dateTime={a.createdAt}>{relativeTime(a.createdAt)}</time>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="text-right text-[11px] text-muted-foreground">Atualizado em {formatDateTime(data.generatedAt)}</p>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  href,
  alert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  alert?: boolean;
}) {
  const content = (
    <div className="flex items-center gap-3 py-3">
      <Icon className={cn('size-4 shrink-0', alert ? 'text-danger' : 'text-muted-foreground')} />
      <dt className="flex-1 text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('text-sm font-semibold tabular', alert && 'text-danger')}>{value}</dd>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-md hover:bg-muted/50">
      {content}
    </Link>
  ) : (
    content
  );
}
