import { CUSTOMER_TYPE_LABELS, ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus, type ReportQuery, type ReportType } from '@horizons/shared';
import { env } from '../../config/env';
import { centsToCsv, toCsv, type CsvColumn } from '../../lib/csv';
import { dateOnlyToUtc, zonedRange } from '../../lib/dates';
import { prisma } from '../../lib/prisma';

type Ctx = { organizationId: string };

/** Formato de agrupamento do Postgres por granularidade (valor fixo, nunca vindo do usuário). */
const PERIOD_FORMAT = { day: 'YYYY-MM-DD', month: 'YYYY-MM' } as const;

export async function salesReport(ctx: Ctx, q: ReportQuery) {
  const tz = env.APP_TIMEZONE;
  const range = zonedRange(q.from, q.to, tz);
  const rows = await prisma.$queryRaw<{ period: string; orders: bigint; revenue: bigint; discount: bigint }[]>`
    SELECT to_char(o.paid_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}, ${PERIOD_FORMAT[q.groupBy]}) AS period,
           COUNT(*)::bigint AS orders,
           COALESCE(SUM(o.total_cents), 0)::bigint AS revenue,
           COALESCE(SUM(o.discount_cents + (
             SELECT COALESCE(SUM(oi.discount_cents), 0) FROM order_items oi WHERE oi.order_id = o.id
           )), 0)::bigint AS discount
    FROM orders o
    WHERE o.organization_id = ${ctx.organizationId}::uuid
      AND o.status IN ('PAID', 'PROCESSING', 'COMPLETED')
      AND o.paid_at >= ${range.gte} AND o.paid_at < ${range.lt}
    GROUP BY 1 ORDER BY 1`;
  const series = rows.map((r) => {
    const orders = Number(r.orders);
    const revenueCents = Number(r.revenue);
    return {
      period: r.period,
      orders,
      revenueCents,
      discountCents: Number(r.discount),
      averageTicketCents: orders > 0 ? Math.round(revenueCents / orders) : 0,
    };
  });
  const totalOrders = series.reduce((a, r) => a + r.orders, 0);
  const totalRevenue = series.reduce((a, r) => a + r.revenueCents, 0);
  return {
    series,
    totals: {
      orders: totalOrders,
      revenueCents: totalRevenue,
      averageTicketCents: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
    },
  };
}

export async function customersReport(ctx: Ctx, q: ReportQuery) {
  const range = zonedRange(q.from, q.to, env.APP_TIMEZONE);
  const customers = await prisma.customer.findMany({
    where: { organizationId: ctx.organizationId, createdAt: range },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      email: true,
      phone: true,
      city: true,
      state: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });
  const tz = env.APP_TIMEZONE;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const bucket = new Map<string, number>();
  const rows = customers.map((c) => {
    const day = fmt.format(c.createdAt);
    const period = q.groupBy === 'month' ? day.slice(0, 7) : day;
    bucket.set(period, (bucket.get(period) ?? 0) + 1);
    const { _count, ...rest } = c;
    return { ...rest, ordersCount: _count.orders };
  });
  return {
    series: [...bucket.entries()].map(([period, count]) => ({ period, count })),
    rows,
    totals: { count: rows.length },
  };
}

export async function topProductsReport(ctx: Ctx, q: ReportQuery) {
  const range = zonedRange(q.from, q.to, env.APP_TIMEZONE);
  const rows = await prisma.$queryRaw<
    { productId: string; name: string; sku: string; quantity: bigint; revenue: bigint; orders: bigint }[]
  >`
    SELECT oi.product_id AS "productId", p.name, p.sku,
           SUM(oi.quantity)::bigint AS quantity,
           SUM(oi.total_cents)::bigint AS revenue,
           COUNT(DISTINCT o.id)::bigint AS orders
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.organization_id = ${ctx.organizationId}::uuid
      AND o.status IN ('PAID', 'PROCESSING', 'COMPLETED')
      AND o.paid_at >= ${range.gte} AND o.paid_at < ${range.lt}
    GROUP BY oi.product_id, p.name, p.sku
    ORDER BY quantity DESC, revenue DESC
    LIMIT 50`;
  return {
    rows: rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      quantity: Number(r.quantity),
      revenueCents: Number(r.revenue),
      orders: Number(r.orders),
    })),
  };
}

export async function revenueReport(ctx: Ctx, q: ReportQuery) {
  const rows = await prisma.$queryRaw<{ period: string; type: 'INCOME' | 'EXPENSE'; total: bigint }[]>`
    SELECT to_char(paid_at, ${PERIOD_FORMAT[q.groupBy]}) AS period, type, SUM(amount_cents)::bigint AS total
    FROM financial_entries
    WHERE organization_id = ${ctx.organizationId}::uuid
      AND status = 'PAID'
      AND paid_at BETWEEN ${dateOnlyToUtc(q.from)}::date AND ${dateOnlyToUtc(q.to)}::date
    GROUP BY 1, 2 ORDER BY 1`;
  const map = new Map<string, { period: string; incomeCents: number; expenseCents: number; resultCents: number }>();
  for (const r of rows) {
    const item = map.get(r.period) ?? { period: r.period, incomeCents: 0, expenseCents: 0, resultCents: 0 };
    if (r.type === 'INCOME') item.incomeCents = Number(r.total);
    else item.expenseCents = Number(r.total);
    item.resultCents = item.incomeCents - item.expenseCents;
    map.set(r.period, item);
  }
  const series = [...map.values()];
  const income = series.reduce((a, r) => a + r.incomeCents, 0);
  const expense = series.reduce((a, r) => a + r.expenseCents, 0);
  return { series, totals: { incomeCents: income, expenseCents: expense, resultCents: income - expense } };
}

export async function ordersByStatusReport(ctx: Ctx, q: ReportQuery) {
  const range = zonedRange(q.from, q.to, env.APP_TIMEZONE);
  const groups = await prisma.order.groupBy({
    by: ['status'],
    where: { organizationId: ctx.organizationId, createdAt: range },
    _count: { _all: true },
    _sum: { totalCents: true },
  });
  const byStatus = new Map(groups.map((g) => [g.status, g]));
  const rows = ORDER_STATUSES.map((status: OrderStatus) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    count: byStatus.get(status)?._count._all ?? 0,
    totalCents: byStatus.get(status)?._sum.totalCents ?? 0,
  }));
  return { rows, totals: { count: rows.reduce((a, r) => a + r.count, 0) } };
}

export async function runReport(ctx: Ctx, type: ReportType, q: ReportQuery) {
  switch (type) {
    case 'sales':
      return salesReport(ctx, q);
    case 'customers':
      return customersReport(ctx, q);
    case 'top-products':
      return topProductsReport(ctx, q);
    case 'revenue':
      return revenueReport(ctx, q);
    case 'orders-by-status':
      return ordersByStatusReport(ctx, q);
  }
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { timeZone: env.APP_TIMEZONE });

export async function exportCsv(ctx: Ctx, type: ReportType, q: ReportQuery): Promise<string> {
  switch (type) {
    case 'sales': {
      const r = await salesReport(ctx, q);
      return toCsv(r.series, [
        { header: 'Período', value: (x) => x.period },
        { header: 'Pedidos', value: (x) => x.orders },
        { header: 'Faturamento (R$)', value: (x) => centsToCsv(x.revenueCents) },
        { header: 'Descontos (R$)', value: (x) => centsToCsv(x.discountCents) },
        { header: 'Ticket médio (R$)', value: (x) => centsToCsv(x.averageTicketCents) },
      ]);
    }
    case 'customers': {
      const r = await customersReport(ctx, q);
      const cols: CsvColumn<(typeof r.rows)[number]>[] = [
        { header: 'Nome / Razão social', value: (x) => x.name },
        { header: 'Tipo', value: (x) => CUSTOMER_TYPE_LABELS[x.type] },
        { header: 'E-mail', value: (x) => x.email },
        { header: 'Telefone', value: (x) => x.phone },
        { header: 'Cidade', value: (x) => x.city },
        { header: 'UF', value: (x) => x.state },
        { header: 'Pedidos', value: (x) => x.ordersCount },
        { header: 'Cadastrado em', value: (x) => dateFmt.format(x.createdAt) },
      ];
      return toCsv(r.rows, cols);
    }
    case 'top-products': {
      const r = await topProductsReport(ctx, q);
      return toCsv(r.rows, [
        { header: 'Produto', value: (x) => x.name },
        { header: 'SKU', value: (x) => x.sku },
        { header: 'Quantidade vendida', value: (x) => x.quantity },
        { header: 'Pedidos', value: (x) => x.orders },
        { header: 'Faturamento (R$)', value: (x) => centsToCsv(x.revenueCents) },
      ]);
    }
    case 'revenue': {
      const r = await revenueReport(ctx, q);
      return toCsv(r.series, [
        { header: 'Período', value: (x) => x.period },
        { header: 'Receitas (R$)', value: (x) => centsToCsv(x.incomeCents) },
        { header: 'Despesas (R$)', value: (x) => centsToCsv(x.expenseCents) },
        { header: 'Resultado (R$)', value: (x) => centsToCsv(x.resultCents) },
      ]);
    }
    case 'orders-by-status': {
      const r = await ordersByStatusReport(ctx, q);
      return toCsv(r.rows, [
        { header: 'Status', value: (x) => x.label },
        { header: 'Pedidos', value: (x) => x.count },
        { header: 'Valor total (R$)', value: (x) => centsToCsv(x.totalCents) },
      ]);
    }
  }
}
