import type { FinanceListQuery, FinancialEntryData } from '@horizons/shared';
import { env } from '../../config/env';
import { dateOnlyToUtc, endOfMonth, startOfMonth, toDateOnly, todayInTz } from '../../lib/dates';
import { notFound, unprocessable } from '../../lib/errors';
import { pageMeta, pagination } from '../../lib/http';
import { prisma, type Prisma } from '../../lib/prisma';
import type { AuthContext } from '../../types/express';
import { logActivity } from '../activity/activity.service';

type Ctx = Pick<AuthContext, 'organizationId' | 'userId'>;

const entryInclude = { order: { select: { id: true, number: true } } } as const;

type EntryRow = Prisma.FinancialEntryGetPayload<{ include: typeof entryInclude }>;

function serialize(entry: EntryRow, today: string) {
  const dueDate = toDateOnly(entry.dueDate);
  return {
    ...entry,
    dueDate,
    paidAt: entry.paidAt ? toDateOnly(entry.paidAt) : null,
    overdue: entry.status === 'PENDING' && dueDate < today,
    /** Lançamentos gerados por pedidos só mudam pelo fluxo do pedido. */
    locked: entry.orderId !== null,
  };
}

async function findOwned(ctx: Ctx, id: string) {
  const entry = await prisma.financialEntry.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: entryInclude,
  });
  if (!entry) throw notFound('Lançamento');
  return entry;
}

function assertManual(entry: { orderId: string | null }) {
  if (entry.orderId) {
    throw unprocessable(
      'Este lançamento foi gerado por um pedido e só pode ser alterado pelo status do pedido.',
      'ENTRY_LOCKED',
    );
  }
}

export async function list(ctx: Ctx, query: FinanceListQuery) {
  const today = todayInTz(env.APP_TIMEZONE);
  const where: Prisma.FinancialEntryWhereInput = { organizationId: ctx.organizationId };
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.overdue) {
    where.status = 'PENDING';
    where.dueDate = { lt: dateOnlyToUtc(today) };
  } else if (query.from || query.to) {
    where.dueDate = {
      ...(query.from ? { gte: dateOnlyToUtc(query.from) } : {}),
      ...(query.to ? { lte: dateOnlyToUtc(query.to) } : {}),
    };
  }
  if (query.search) {
    where.OR = [
      { description: { contains: query.search, mode: 'insensitive' } },
      { category: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  const [total, rows] = await prisma.$transaction([
    prisma.financialEntry.count({ where }),
    prisma.financialEntry.findMany({
      where,
      include: entryInclude,
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      ...pagination(query.page, query.pageSize),
    }),
  ]);
  return { data: rows.map((r) => serialize(r, today)), meta: pageMeta(query.page, query.pageSize, total) };
}

async function sum(where: Prisma.FinancialEntryWhereInput) {
  const r = await prisma.financialEntry.aggregate({ where, _sum: { amountCents: true }, _count: true });
  return { cents: r._sum.amountCents ?? 0, count: r._count };
}

/**
 * Resumo financeiro.
 * - Receitas/despesas do período: lançamentos PAGOS com data de pagamento no período (regime de caixa).
 * - Saldo: todas as receitas pagas − todas as despesas pagas.
 * - Contas a receber/pagar: lançamentos pendentes (independente do período).
 */
export async function summary(ctx: Ctx, period: { from?: string; to?: string }) {
  const today = todayInTz(env.APP_TIMEZONE);
  const from = period.from ?? startOfMonth(today);
  const to = period.to ?? endOfMonth(today);
  const org = { organizationId: ctx.organizationId };
  const paidRange = { gte: dateOnlyToUtc(from), lte: dateOnlyToUtc(to) };
  const overdue = { lt: dateOnlyToUtc(today) };

  const [income, expense, incomeAll, expenseAll, receivable, payable, receivableOverdue, payableOverdue] =
    await Promise.all([
      sum({ ...org, type: 'INCOME', status: 'PAID', paidAt: paidRange }),
      sum({ ...org, type: 'EXPENSE', status: 'PAID', paidAt: paidRange }),
      sum({ ...org, type: 'INCOME', status: 'PAID' }),
      sum({ ...org, type: 'EXPENSE', status: 'PAID' }),
      sum({ ...org, type: 'INCOME', status: 'PENDING' }),
      sum({ ...org, type: 'EXPENSE', status: 'PENDING' }),
      sum({ ...org, type: 'INCOME', status: 'PENDING', dueDate: overdue }),
      sum({ ...org, type: 'EXPENSE', status: 'PENDING', dueDate: overdue }),
    ]);

  return {
    period: { from, to },
    incomeCents: income.cents,
    expenseCents: expense.cents,
    resultCents: income.cents - expense.cents,
    balanceCents: incomeAll.cents - expenseAll.cents,
    receivable: { cents: receivable.cents, count: receivable.count, overdueCents: receivableOverdue.cents, overdueCount: receivableOverdue.count },
    payable: { cents: payable.cents, count: payable.count, overdueCents: payableOverdue.cents, overdueCount: payableOverdue.count },
  };
}

/** Fluxo de caixa mensal (receitas × despesas pagas) entre duas datas. */
export async function cashflow(ctx: Ctx, from: string, to: string) {
  const rows = await prisma.$queryRaw<{ month: string; type: 'INCOME' | 'EXPENSE'; total: bigint }[]>`
    SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month, type, SUM(amount_cents)::bigint AS total
    FROM financial_entries
    WHERE organization_id = ${ctx.organizationId}::uuid
      AND status = 'PAID'
      AND paid_at BETWEEN ${dateOnlyToUtc(from)}::date AND ${dateOnlyToUtc(to)}::date
    GROUP BY 1, 2
    ORDER BY 1`;
  const months = new Map<string, { month: string; incomeCents: number; expenseCents: number }>();
  for (const r of rows) {
    const m = months.get(r.month) ?? { month: r.month, incomeCents: 0, expenseCents: 0 };
    if (r.type === 'INCOME') m.incomeCents = Number(r.total);
    else m.expenseCents = Number(r.total);
    months.set(r.month, m);
  }
  return [...months.values()];
}

export async function categories(ctx: Ctx) {
  const rows = await prisma.financialEntry.findMany({
    where: { organizationId: ctx.organizationId },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}

export async function get(ctx: Ctx, id: string) {
  return serialize(await findOwned(ctx, id), todayInTz(env.APP_TIMEZONE));
}

function toDbData(data: FinancialEntryData) {
  return {
    type: data.type,
    description: data.description,
    category: data.category,
    amountCents: data.amountCents,
    dueDate: dateOnlyToUtc(data.dueDate),
    status: data.status,
    paidAt: data.paidAt ? dateOnlyToUtc(data.paidAt) : null,
    notes: data.notes,
  };
}

export async function create(ctx: Ctx, data: FinancialEntryData) {
  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.financialEntry.create({
      data: { ...toDbData(data), organizationId: ctx.organizationId, createdById: ctx.userId },
      include: entryInclude,
    });
    await logActivity(tx, ctx, {
      action: 'finance.created',
      entityType: 'finance',
      entityId: created.id,
      description: `${data.type === 'INCOME' ? 'Receita' : 'Despesa'} "${created.description}" lançada`,
    });
    return created;
  });
  return serialize(entry, todayInTz(env.APP_TIMEZONE));
}

export async function update(ctx: Ctx, id: string, data: FinancialEntryData) {
  const current = await findOwned(ctx, id);
  assertManual(current);
  if (current.status !== 'PENDING') {
    throw unprocessable('Apenas lançamentos pendentes podem ser editados.', 'ENTRY_LOCKED');
  }
  const entry = await prisma.financialEntry.update({ where: { id }, data: toDbData(data), include: entryInclude });
  await logActivity(prisma, ctx, {
    action: 'finance.updated',
    entityType: 'finance',
    entityId: id,
    description: `Lançamento "${entry.description}" atualizado`,
  });
  return serialize(entry, todayInTz(env.APP_TIMEZONE));
}

export async function pay(ctx: Ctx, id: string, paidAt?: string) {
  const current = await findOwned(ctx, id);
  assertManual(current);
  if (current.status !== 'PENDING') throw unprocessable('Apenas lançamentos pendentes podem ser baixados.', 'ENTRY_LOCKED');
  const date = paidAt ?? todayInTz(env.APP_TIMEZONE);
  const entry = await prisma.financialEntry.update({
    where: { id },
    data: { status: 'PAID', paidAt: dateOnlyToUtc(date) },
    include: entryInclude,
  });
  await logActivity(prisma, ctx, {
    action: 'finance.paid',
    entityType: 'finance',
    entityId: id,
    description: `Lançamento "${entry.description}" marcado como pago`,
  });
  return serialize(entry, todayInTz(env.APP_TIMEZONE));
}

export async function cancel(ctx: Ctx, id: string) {
  const current = await findOwned(ctx, id);
  assertManual(current);
  if (current.status === 'CANCELED') throw unprocessable('O lançamento já está cancelado.', 'ENTRY_LOCKED');
  const entry = await prisma.financialEntry.update({ where: { id }, data: { status: 'CANCELED' }, include: entryInclude });
  await logActivity(prisma, ctx, {
    action: 'finance.canceled',
    entityType: 'finance',
    entityId: id,
    description: `Lançamento "${entry.description}" cancelado`,
  });
  return serialize(entry, todayInTz(env.APP_TIMEZONE));
}

export async function remove(ctx: Ctx, id: string) {
  const current = await findOwned(ctx, id);
  assertManual(current);
  if (current.status === 'PAID') {
    throw unprocessable('Lançamentos pagos não podem ser excluídos. Cancele o lançamento para estorná-lo.', 'ENTRY_LOCKED');
  }
  await prisma.financialEntry.delete({ where: { id } });
  await logActivity(prisma, ctx, {
    action: 'finance.deleted',
    entityType: 'finance',
    description: `Lançamento "${current.description}" excluído`,
  });
}
