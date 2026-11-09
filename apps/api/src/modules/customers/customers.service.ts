import { REVENUE_ORDER_STATUSES, type CustomerData, type CustomerListQuery } from '@horizons/shared';
import { conflict, notFound } from '../../lib/errors';
import { pageMeta, pagination } from '../../lib/http';
import { prisma, type Prisma } from '../../lib/prisma';
import type { AuthContext } from '../../types/express';
import { logActivity } from '../activity/activity.service';

type Ctx = Pick<AuthContext, 'organizationId' | 'userId'>;

/** Toda consulta passa pelo organizationId do usuário autenticado → isolamento entre empresas. */
async function findOwned(ctx: Ctx, id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!customer) throw notFound('Cliente');
  return customer;
}

export async function list(ctx: Ctx, query: CustomerListQuery) {
  const where: Prisma.CustomerWhereInput = { organizationId: ctx.organizationId };
  if (query.type) where.type = query.type;
  if (query.search) {
    const term = query.search;
    const digits = term.replace(/\D/g, '');
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { city: { contains: term, mode: 'insensitive' } },
      ...(digits.length >= 3 ? [{ document: { contains: digits } }, { phone: { contains: digits } }] : []),
    ];
  }
  const [total, data] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
      ...pagination(query.page, query.pageSize),
      include: { _count: { select: { orders: true } } },
    }),
  ]);
  return {
    data: data.map(({ _count, ...c }) => ({ ...c, ordersCount: _count.orders })),
    meta: pageMeta(query.page, query.pageSize, total),
  };
}

export async function get(ctx: Ctx, id: string) {
  const customer = await findOwned(ctx, id);
  const [ordersCount, revenue, lastOrder] = await Promise.all([
    prisma.order.count({ where: { customerId: id, organizationId: ctx.organizationId } }),
    prisma.order.aggregate({
      where: { customerId: id, organizationId: ctx.organizationId, status: { in: [...REVENUE_ORDER_STATUSES] } },
      _sum: { totalCents: true },
    }),
    prisma.order.findFirst({
      where: { customerId: id, organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  return {
    ...customer,
    stats: {
      ordersCount,
      totalSpentCents: revenue._sum.totalCents ?? 0,
      lastOrderAt: lastOrder?.createdAt ?? null,
    },
  };
}

export async function create(ctx: Ctx, data: CustomerData) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({ data: { ...data, organizationId: ctx.organizationId } });
    await logActivity(tx, ctx, {
      action: 'customer.created',
      entityType: 'customer',
      entityId: customer.id,
      description: `Cliente ${customer.name} cadastrado`,
    });
    return customer;
  });
}

export async function update(ctx: Ctx, id: string, data: CustomerData) {
  await findOwned(ctx, id);
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.update({ where: { id }, data });
    await logActivity(tx, ctx, {
      action: 'customer.updated',
      entityType: 'customer',
      entityId: id,
      description: `Cliente ${customer.name} atualizado`,
    });
    return customer;
  });
}

export async function remove(ctx: Ctx, id: string) {
  const customer = await findOwned(ctx, id);
  const orders = await prisma.order.count({ where: { customerId: id } });
  if (orders > 0) {
    throw conflict(
      `Não é possível excluir: o cliente possui ${orders} pedido(s) vinculado(s). O histórico comercial deve ser preservado.`,
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.customer.delete({ where: { id } });
    await logActivity(tx, ctx, {
      action: 'customer.deleted',
      entityType: 'customer',
      entityId: null,
      description: `Cliente ${customer.name} excluído`,
    });
  });
}
