import { formatOrderNumber, hasPermission, REVENUE_ORDER_STATUSES, type OrderStatus } from '@horizons/shared';
import { env } from '../../config/env';
import { addDays, addMonths, dateOnlyToUtc, endOfMonth, startOfMonth, todayInTz, zonedRange } from '../../lib/dates';
import { prisma } from '../../lib/prisma';
import type { AuthContext } from '../../types/express';

const OPEN_STATUSES: OrderStatus[] = ['QUOTE', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING'];

export async function getDashboard(ctx: Pick<AuthContext, 'organizationId' | 'role'>) {
  const tz = env.APP_TIMEZONE;
  const orgId = ctx.organizationId;
  const today = todayInTz(tz);
  const month = zonedRange(startOfMonth(today), endOfMonth(today), tz);
  const prevMonthStart = addMonths(today, -1);
  const prevMonth = zonedRange(prevMonthStart, endOfMonth(prevMonthStart), tz);
  const last90 = zonedRange(addDays(today, -89), today, tz);
  const revenueStatuses = [...REVENUE_ORDER_STATUSES];
  const org = { organizationId: orgId };

  const [
    customersTotal,
    customersMonth,
    salesTotal,
    salesMonth,
    revenueMonth,
    revenuePrevMonth,
    openByStatus,
    created90,
    converted90,
    canceled90,
    lowStock,
    recentOrders,
    activities,
    monthlyRows,
    dailyRows,
  ] = await Promise.all([
    prisma.customer.count({ where: org }),
    prisma.customer.count({ where: { ...org, createdAt: month } }),
    prisma.order.count({ where: { ...org, status: { in: revenueStatuses } } }),
    prisma.order.count({ where: { ...org, status: { in: revenueStatuses }, paidAt: month } }),
    prisma.order.aggregate({ where: { ...org, status: { in: revenueStatuses }, paidAt: month }, _sum: { totalCents: true } }),
    prisma.order.aggregate({ where: { ...org, status: { in: revenueStatuses }, paidAt: prevMonth }, _sum: { totalCents: true } }),
    prisma.order.groupBy({ by: ['status'], where: { ...org, status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
    prisma.order.count({ where: { ...org, createdAt: last90 } }),
    prisma.order.count({ where: { ...org, createdAt: last90, status: { in: revenueStatuses } } }),
    prisma.order.count({ where: { ...org, createdAt: last90, status: 'CANCELED' } }),
    prisma.product.count({ where: { ...org, type: 'PRODUCT', active: true, stock: { lte: prisma.product.fields.minStock } } }),
    prisma.order.findMany({
      where: org,
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, number: true, status: true, totalCents: true, createdAt: true, customer: { select: { name: true } } },
    }),
    prisma.activityLog.findMany({
      where: org,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
    // Evolução mensal (12 meses) por data de pagamento, no fuso da aplicação.
    prisma.$queryRaw<{ period: string; orders: bigint; revenue: bigint }[]>`
      SELECT to_char(date_trunc('month', paid_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}), 'YYYY-MM') AS period,
             COUNT(*)::bigint AS orders, COALESCE(SUM(total_cents), 0)::bigint AS revenue
      FROM orders
      WHERE organization_id = ${orgId}::uuid
        AND status IN ('PAID', 'PROCESSING', 'COMPLETED')
        AND paid_at >= ${zonedRange(addMonths(today, -11), today, tz).gte}
      GROUP BY 1 ORDER BY 1`,
    // Vendas diárias (30 dias)
    prisma.$queryRaw<{ period: string; orders: bigint; revenue: bigint }[]>`
      SELECT to_char(paid_at AT TIME ZONE 'UTC' AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS period,
             COUNT(*)::bigint AS orders, COALESCE(SUM(total_cents), 0)::bigint AS revenue
      FROM orders
      WHERE organization_id = ${orgId}::uuid
        AND status IN ('PAID', 'PROCESSING', 'COMPLETED')
        AND paid_at >= ${zonedRange(addDays(today, -29), today, tz).gte}
      GROUP BY 1 ORDER BY 1`,
  ]);

  // Preenche períodos sem vendas com zero para gráficos contínuos.
  const monthlyMap = new Map(monthlyRows.map((r) => [r.period, r]));
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const period = addMonths(today, i - 11).slice(0, 7);
    const row = monthlyMap.get(period);
    return { period, orders: Number(row?.orders ?? 0), revenueCents: Number(row?.revenue ?? 0) };
  });
  const dailyMap = new Map(dailyRows.map((r) => [r.period, r]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const period = addDays(today, i - 29);
    const row = dailyMap.get(period);
    return { period, orders: Number(row?.orders ?? 0), revenueCents: Number(row?.revenue ?? 0) };
  });

  const revenueMonthCents = revenueMonth._sum.totalCents ?? 0;
  const revenuePrevCents = revenuePrevMonth._sum.totalCents ?? 0;
  const pendingByStatus = Object.fromEntries(openByStatus.map((g) => [g.status, g._count._all])) as Partial<
    Record<OrderStatus, number>
  >;

  let finance: { receivableCents: number; overdueCount: number; overdueCents: number } | null = null;
  if (hasPermission(ctx.role, 'finance:read')) {
    const [receivable, overdue] = await Promise.all([
      prisma.financialEntry.aggregate({ where: { ...org, type: 'INCOME', status: 'PENDING' }, _sum: { amountCents: true } }),
      prisma.financialEntry.aggregate({
        where: { ...org, type: 'INCOME', status: 'PENDING', dueDate: { lt: dateOnlyToUtc(today) } },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);
    finance = {
      receivableCents: receivable._sum.amountCents ?? 0,
      overdueCents: overdue._sum.amountCents ?? 0,
      overdueCount: overdue._count,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    customers: { total: customersTotal, newThisMonth: customersMonth },
    sales: { total: salesTotal, thisMonth: salesMonth },
    revenue: {
      monthCents: revenueMonthCents,
      previousMonthCents: revenuePrevCents,
      changePct: revenuePrevCents > 0 ? ((revenueMonthCents - revenuePrevCents) / revenuePrevCents) * 100 : null,
    },
    pendingOrders: {
      total: Object.values(pendingByStatus).reduce((a, b) => a + (b ?? 0), 0),
      byStatus: pendingByStatus,
    },
    kpis: {
      averageTicketCents: salesMonth > 0 ? Math.round(revenueMonthCents / salesMonth) : 0,
      conversionRatePct: created90 > 0 ? (converted90 / created90) * 100 : null,
      cancellationRatePct: created90 > 0 ? (canceled90 / created90) * 100 : null,
      lowStockProducts: lowStock,
    },
    finance,
    monthly,
    daily,
    recentOrders: recentOrders.map((o) => ({ ...o, code: formatOrderNumber(o.number) })),
    activities: activities.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      description: a.description,
      createdAt: a.createdAt,
      userName: a.user?.name ?? null,
    })),
  };
}
