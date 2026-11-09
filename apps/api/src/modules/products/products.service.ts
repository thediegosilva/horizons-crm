import type { ProductData, ProductListQuery } from '@horizons/shared';
import { conflict, notFound } from '../../lib/errors';
import { pageMeta, pagination } from '../../lib/http';
import { prisma, type Prisma } from '../../lib/prisma';
import type { AuthContext } from '../../types/express';
import { logActivity } from '../activity/activity.service';

type Ctx = Pick<AuthContext, 'organizationId' | 'userId'>;

async function findOwned(ctx: Ctx, id: string) {
  const product = await prisma.product.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!product) throw notFound('Produto');
  return product;
}

/** Serviços não controlam estoque. */
function normalize(data: ProductData): ProductData {
  return data.type === 'SERVICE' ? { ...data, stock: 0, minStock: 0 } : data;
}

export async function list(ctx: Ctx, query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = { organizationId: ctx.organizationId };
  if (query.type) where.type = query.type;
  if (query.category) where.category = query.category;
  if (query.active !== undefined) where.active = query.active;
  if (query.lowStock) {
    where.type = 'PRODUCT';
    where.stock = { lte: prisma.product.fields.minStock };
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
      { category: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  const [total, data] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
      ...pagination(query.page, query.pageSize),
    }),
  ]);
  return { data, meta: pageMeta(query.page, query.pageSize, total) };
}

export async function categories(ctx: Ctx) {
  const rows = await prisma.product.findMany({
    where: { organizationId: ctx.organizationId },
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}

export async function get(ctx: Ctx, id: string) {
  const product = await findOwned(ctx, id);
  const sold = await prisma.orderItem.aggregate({
    where: { productId: id, order: { status: { in: ['PAID', 'PROCESSING', 'COMPLETED'] } } },
    _sum: { quantity: true, totalCents: true },
  });
  return {
    ...product,
    stats: { unitsSold: sold._sum.quantity ?? 0, revenueCents: sold._sum.totalCents ?? 0 },
  };
}

export async function create(ctx: Ctx, data: ProductData) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: { ...normalize(data), organizationId: ctx.organizationId } });
    await logActivity(tx, ctx, {
      action: 'product.created',
      entityType: 'product',
      entityId: product.id,
      description: `Produto ${product.name} (${product.sku}) cadastrado`,
    });
    return product;
  });
}

export async function update(ctx: Ctx, id: string, data: ProductData) {
  const current = await findOwned(ctx, id);
  if (current.type !== data.type) {
    const used = await prisma.orderItem.count({ where: { productId: id } });
    if (used > 0) throw conflict('Não é possível alterar o tipo de um item que já possui vendas.');
  }
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id }, data: normalize(data) });
    await logActivity(tx, ctx, {
      action: 'product.updated',
      entityType: 'product',
      entityId: id,
      description: `Produto ${product.name} atualizado`,
    });
    return product;
  });
}

export async function remove(ctx: Ctx, id: string) {
  const product = await findOwned(ctx, id);
  const used = await prisma.orderItem.count({ where: { productId: id } });
  if (used > 0) {
    throw conflict('Não é possível excluir: o produto já foi utilizado em pedidos. Desative-o para impedir novas vendas.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.product.delete({ where: { id } });
    await logActivity(tx, ctx, {
      action: 'product.deleted',
      entityType: 'product',
      description: `Produto ${product.name} (${product.sku}) excluído`,
    });
  });
}
