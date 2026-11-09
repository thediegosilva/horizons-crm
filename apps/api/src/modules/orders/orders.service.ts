import {
  calculateOrderTotals,
  canTransition,
  formatOrderNumber,
  hasPermission,
  isOrderEditable,
  ORDER_STATUS_LABELS,
  OrderCalculationError,
  type OrderData,
  type OrderListQuery,
  type OrderStatus,
  type OrderStatusInput,
} from '@horizons/shared';
import { env } from '../../config/env';
import { addDays, dateOnlyToUtc, todayInTz, zonedRange } from '../../lib/dates';
import { AppError, conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import { pageMeta, pagination } from '../../lib/http';
import { prisma, type Prisma, type Tx } from '../../lib/prisma';
import type { AuthContext } from '../../types/express';
import { logActivity, notifyRoles } from '../activity/activity.service';

type Ctx = Pick<AuthContext, 'organizationId' | 'userId' | 'role'>;

/** Prazo padrão de vencimento da conta a receber gerada por um pedido. */
export const RECEIVABLE_DUE_DAYS = 7;

const orderInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true, document: true, type: true } },
  createdBy: { select: { id: true, name: true } },
  items: { orderBy: { productName: 'asc' } },
  statusHistory: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true } } } },
  financialEntries: {
    orderBy: { createdAt: 'asc' },
    select: { id: true, type: true, status: true, amountCents: true, dueDate: true, paidAt: true, description: true },
  },
} satisfies Prisma.OrderInclude;

async function findOwned(db: Tx | typeof prisma, ctx: Ctx, id: string) {
  const order = await db.order.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!order) throw notFound('Pedido');
  return order;
}

/** Valida cliente e produtos (sempre da mesma organização) e calcula os itens com snapshot de preço. */
async function buildItems(tx: Tx, ctx: Ctx, data: OrderData) {
  const customer = await tx.customer.findFirst({
    where: { id: data.customerId, organizationId: ctx.organizationId },
    select: { id: true, name: true },
  });
  if (!customer) throw unprocessable('Cliente não encontrado.', 'INVALID_CUSTOMER');

  const productIds = data.items.map((i) => i.productId);
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, organizationId: ctx.organizationId },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = data.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw unprocessable('Um dos produtos informados não foi encontrado.', 'INVALID_PRODUCT');
    if (!product.active) throw unprocessable(`O produto "${product.name}" está inativo.`, 'INACTIVE_PRODUCT');
    return { product, quantity: item.quantity, unitPriceCents: product.priceCents, discountCents: item.discountCents };
  });

  let totals;
  try {
    totals = calculateOrderTotals(lines, data.discountCents);
  } catch (err) {
    if (err instanceof OrderCalculationError) throw unprocessable(err.message, 'INVALID_TOTALS');
    throw err;
  }

  const items = lines.map((line, i) => ({
    productId: line.product.id,
    productName: line.product.name,
    productSku: line.product.sku,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    discountCents: line.discountCents,
    totalCents: totals.lines[i]!.totalCents,
  }));

  return { customer, items, totals };
}

/** Baixa o estoque de forma atômica: a atualização só ocorre se houver saldo suficiente. */
async function reserveStock(tx: Tx, ctx: Ctx, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: { product: { select: { type: true, name: true } } },
  });
  for (const item of items) {
    if (item.product.type !== 'PRODUCT') continue;
    const result = await tx.product.updateMany({
      where: { id: item.productId, organizationId: ctx.organizationId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (result.count !== 1) {
      throw conflict(`Estoque insuficiente para "${item.product.name}".`, { productId: item.productId });
    }
  }
  const low = await tx.product.findMany({
    where: {
      id: { in: items.map((i) => i.productId) },
      type: 'PRODUCT',
      stock: { lte: tx.product.fields.minStock },
    },
    select: { name: true, stock: true },
  });
  for (const p of low) {
    await notifyRoles(tx, ctx, ['ADMIN', 'MANAGER'], {
      title: 'Estoque baixo',
      message: `"${p.name}" está com ${p.stock} unidade(s) em estoque.`,
      link: '/products?lowStock=true',
    });
  }
}

async function releaseStock(tx: Tx, ctx: Ctx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, include: { product: { select: { type: true } } } });
  for (const item of items) {
    if (item.product.type !== 'PRODUCT') continue;
    await tx.product.updateMany({
      where: { id: item.productId, organizationId: ctx.organizationId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

export async function list(ctx: Ctx, query: OrderListQuery) {
  const where: Prisma.OrderWhereInput = { organizationId: ctx.organizationId };
  if (query.status) where.status = query.status;
  if (query.customerId) where.customerId = query.customerId;
  if (query.from || query.to) {
    const range = zonedRange(query.from ?? '2000-01-01', query.to ?? '2999-12-31', env.APP_TIMEZONE);
    where.createdAt = range;
  }
  if (query.search) {
    const numeric = Number(query.search.replace(/\D/g, ''));
    where.OR = [
      { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ...(Number.isSafeInteger(numeric) && numeric > 0 && numeric < 2 ** 31 ? [{ number: numeric }] : []),
    ];
  }
  const [total, data] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { number: 'desc' }],
      ...pagination(query.page, query.pageSize),
      include: { customer: { select: { id: true, name: true } }, _count: { select: { items: true } } },
    }),
  ]);
  return {
    data: data.map(({ _count, ...o }) => ({ ...o, code: formatOrderNumber(o.number), itemsCount: _count.items })),
    meta: pageMeta(query.page, query.pageSize, total),
  };
}

export async function get(ctx: Ctx, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: orderInclude,
  });
  if (!order) throw notFound('Pedido');
  return { ...order, code: formatOrderNumber(order.number) };
}

export async function create(ctx: Ctx, data: OrderData) {
  const order = await prisma.$transaction(async (tx) => {
    const { customer, items, totals } = await buildItems(tx, ctx, data);
    // Número sequencial por organização, incrementado de forma atômica.
    const org = await tx.organization.update({
      where: { id: ctx.organizationId },
      data: { orderSeq: { increment: 1 } },
      select: { orderSeq: true },
    });
    const created = await tx.order.create({
      data: {
        organizationId: ctx.organizationId,
        number: org.orderSeq,
        customerId: customer.id,
        createdById: ctx.userId,
        status: 'QUOTE',
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        totalCents: totals.totalCents,
        notes: data.notes,
        items: { create: items },
        statusHistory: { create: { toStatus: 'QUOTE', userId: ctx.userId, note: 'Pedido criado' } },
      },
    });
    await logActivity(tx, ctx, {
      action: 'order.created',
      entityType: 'order',
      entityId: created.id,
      description: `Pedido ${formatOrderNumber(created.number)} criado para ${customer.name}`,
    });
    return created;
  });
  return get(ctx, order.id);
}

export async function update(ctx: Ctx, id: string, data: OrderData) {
  await prisma.$transaction(async (tx) => {
    const order = await findOwned(tx, ctx, id);
    if (!isOrderEditable(order.status)) {
      throw unprocessable(
        `Pedidos com status "${ORDER_STATUS_LABELS[order.status]}" não podem ser alterados.`,
        'ORDER_LOCKED',
      );
    }
    const { customer, items, totals } = await buildItems(tx, ctx, data);

    if (order.stockReserved) await releaseStock(tx, ctx, id);
    await tx.orderItem.deleteMany({ where: { orderId: id } });
    // Atualização condicional ao status lido → evita sobrescrever uma alteração concorrente.
    const updated = await tx.order.updateMany({
      where: { id, status: order.status },
      data: {
        customerId: customer.id,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        totalCents: totals.totalCents,
        notes: data.notes,
      },
    });
    if (updated.count !== 1) throw conflict('O pedido foi alterado por outro usuário. Recarregue e tente novamente.');
    await tx.orderItem.createMany({ data: items.map((i) => ({ ...i, orderId: id })) });

    if (order.stockReserved) {
      await reserveStock(tx, ctx, id);
      // Mantém a conta a receber coerente com o novo total.
      await syncReceivable(tx, ctx, { ...order, totalCents: totals.totalCents });
    }

    await logActivity(tx, ctx, {
      action: 'order.updated',
      entityType: 'order',
      entityId: id,
      description: `Pedido ${formatOrderNumber(order.number)} atualizado`,
    });
  });
  return get(ctx, id);
}

/** Cria/atualiza a conta a receber pendente do pedido. */
async function syncReceivable(
  tx: Tx,
  ctx: Ctx,
  order: { id: string; number: number; totalCents: number; customerId: string },
) {
  const pending = await tx.financialEntry.findFirst({
    where: { orderId: order.id, type: 'INCOME', status: 'PENDING' },
  });
  if (order.totalCents === 0) {
    if (pending) await tx.financialEntry.update({ where: { id: pending.id }, data: { status: 'CANCELED' } });
    return;
  }
  if (pending) {
    await tx.financialEntry.update({ where: { id: pending.id }, data: { amountCents: order.totalCents } });
    return;
  }
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: order.customerId }, select: { name: true } });
  await tx.financialEntry.create({
    data: {
      organizationId: ctx.organizationId,
      orderId: order.id,
      type: 'INCOME',
      status: 'PENDING',
      category: 'Vendas',
      description: `Pedido ${formatOrderNumber(order.number)} — ${customer.name}`,
      amountCents: order.totalCents,
      dueDate: dateOnlyToUtc(addDays(todayInTz(env.APP_TIMEZONE), RECEIVABLE_DUE_DAYS)),
      createdById: ctx.userId,
    },
  });
}

export async function changeStatus(ctx: Ctx, id: string, input: OrderStatusInput) {
  const target = input.status;
  if (target === 'CANCELED' && !hasPermission(ctx.role, 'orders:cancel')) {
    throw forbidden('Você não tem permissão para cancelar pedidos.');
  }

  await prisma.$transaction(async (tx) => {
    const order = await findOwned(tx, ctx, id);
    const from = order.status;
    if (from === target) throw unprocessable('O pedido já está neste status.', 'INVALID_TRANSITION');
    if (!canTransition(from, target)) {
      throw unprocessable(
        `Transição inválida: "${ORDER_STATUS_LABELS[from]}" → "${ORDER_STATUS_LABELS[target]}".`,
        'INVALID_TRANSITION',
      );
    }

    const now = new Date();
    const today = dateOnlyToUtc(todayInTz(env.APP_TIMEZONE, now));
    const data: Prisma.OrderUpdateManyMutationInput = { status: target };
    const code = formatOrderNumber(order.number);

    // Bloqueio otimista: só altera se o status ainda for o que foi lido.
    const changed = await tx.order.updateMany({ where: { id, status: from }, data });
    if (changed.count !== 1) throw conflict('O pedido foi alterado por outro usuário. Recarregue e tente novamente.');

    switch (target) {
      case 'AWAITING_PAYMENT': {
        if (!order.stockReserved) {
          await reserveStock(tx, ctx, id);
          await tx.order.update({ where: { id }, data: { stockReserved: true } });
        }
        await syncReceivable(tx, ctx, order);
        break;
      }
      case 'QUOTE': {
        // Volta para orçamento: devolve estoque e cancela a cobrança pendente.
        if (order.stockReserved) {
          await releaseStock(tx, ctx, id);
          await tx.order.update({ where: { id }, data: { stockReserved: false } });
        }
        await tx.financialEntry.updateMany({
          where: { orderId: id, type: 'INCOME', status: 'PENDING' },
          data: { status: 'CANCELED' },
        });
        break;
      }
      case 'PAID': {
        const entry = await tx.financialEntry.findFirst({ where: { orderId: id, type: 'INCOME', status: 'PENDING' } });
        if (entry) {
          await tx.financialEntry.update({ where: { id: entry.id }, data: { status: 'PAID', paidAt: today } });
        }
        await tx.order.update({ where: { id }, data: { paidAt: now } });
        await notifyRoles(tx, ctx, ['ADMIN', 'MANAGER'], {
          title: 'Pagamento confirmado',
          message: `${code} foi marcado como pago.`,
          link: `/orders/${id}`,
        });
        break;
      }
      case 'COMPLETED': {
        await tx.order.update({ where: { id }, data: { completedAt: now } });
        break;
      }
      case 'CANCELED': {
        if (order.stockReserved) {
          await releaseStock(tx, ctx, id);
        }
        await tx.order.update({ where: { id }, data: { canceledAt: now, stockReserved: false } });
        await tx.financialEntry.updateMany({
          where: { orderId: id, type: 'INCOME', status: 'PENDING' },
          data: { status: 'CANCELED' },
        });
        // Pedido já pago: registra o estorno como despesa para manter o saldo coerente.
        const paid = await tx.financialEntry.aggregate({
          where: { orderId: id, type: 'INCOME', status: 'PAID' },
          _sum: { amountCents: true },
        });
        const refund = paid._sum.amountCents ?? 0;
        if (refund > 0) {
          await tx.financialEntry.create({
            data: {
              organizationId: ctx.organizationId,
              orderId: id,
              type: 'EXPENSE',
              status: 'PAID',
              category: 'Estornos',
              description: `Estorno do pedido ${code}`,
              amountCents: refund,
              dueDate: today,
              paidAt: today,
              createdById: ctx.userId,
            },
          });
        }
        await notifyRoles(tx, ctx, ['ADMIN', 'MANAGER'], {
          title: 'Pedido cancelado',
          message: `${code} foi cancelado${refund > 0 ? ' e o estorno foi registrado no financeiro' : ''}.`,
          link: `/orders/${id}`,
        });
        break;
      }
      default:
        break;
    }

    await tx.orderStatusHistory.create({
      data: { orderId: id, fromStatus: from, toStatus: target, userId: ctx.userId, note: input.note },
    });
    await logActivity(tx, ctx, {
      action: 'order.status_changed',
      entityType: 'order',
      entityId: id,
      description: `Pedido ${code}: ${ORDER_STATUS_LABELS[from]} → ${ORDER_STATUS_LABELS[target]}`,
    });
  });

  return get(ctx, id);
}

/** Apenas orçamentos (sem efeito em estoque ou financeiro) podem ser excluídos. */
export async function remove(ctx: Ctx, id: string) {
  await prisma.$transaction(async (tx) => {
    const order = await findOwned(tx, ctx, id);
    if (order.status !== 'QUOTE') {
      throw unprocessable('Apenas pedidos em orçamento podem ser excluídos. Cancele o pedido.', 'ORDER_LOCKED');
    }
    const deleted = await tx.order.deleteMany({ where: { id, status: 'QUOTE' } });
    if (deleted.count !== 1) throw new AppError(409, 'CONFLICT', 'O pedido foi alterado por outro usuário.');
    await logActivity(tx, ctx, {
      action: 'order.deleted',
      entityType: 'order',
      description: `Orçamento ${formatOrderNumber(order.number)} excluído`,
    });
  });
}

