import type { OrderStatus } from './enums';

/**
 * Máquina de estados do pedido.
 * Concluído e Cancelado são estados finais: nenhuma transição sai deles.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  QUOTE: ['AWAITING_PAYMENT', 'CANCELED'],
  AWAITING_PAYMENT: ['PAID', 'QUOTE', 'CANCELED'],
  PAID: ['PROCESSING', 'CANCELED'],
  PROCESSING: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Itens, cliente e descontos só podem ser alterados antes do pagamento. */
export const EDITABLE_ORDER_STATUSES: readonly OrderStatus[] = ['QUOTE', 'AWAITING_PAYMENT'];

export function isOrderEditable(status: OrderStatus): boolean {
  return EDITABLE_ORDER_STATUSES.includes(status);
}

export function isOrderFinal(status: OrderStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELED';
}

/** Status em que o estoque está reservado e existe conta a receber vinculada. */
export const COMMITTED_ORDER_STATUSES: readonly OrderStatus[] = [
  'AWAITING_PAYMENT',
  'PAID',
  'PROCESSING',
  'COMPLETED',
];

/** Status que contam como venda efetivada (faturamento). */
export const REVENUE_ORDER_STATUSES: readonly OrderStatus[] = ['PAID', 'PROCESSING', 'COMPLETED'];

export interface OrderLineInput {
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
}

export interface OrderLineResult extends OrderLineInput {
  grossCents: number;
  totalCents: number;
}

export interface OrderTotals {
  lines: OrderLineResult[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

export class OrderCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderCalculationError';
  }
}

function assertNonNegativeInt(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new OrderCalculationError(`${field} deve ser um inteiro não negativo.`);
  }
}

/**
 * Calcula os totais de um pedido em centavos.
 * - total do item = quantidade × preço unitário − desconto do item
 * - subtotal = soma dos totais dos itens
 * - total = subtotal − desconto do pedido
 * Descontos nunca podem superar o valor ao qual se aplicam.
 */
export function calculateOrderTotals(lines: OrderLineInput[], orderDiscountCents = 0): OrderTotals {
  if (lines.length === 0) {
    throw new OrderCalculationError('O pedido precisa ter ao menos um item.');
  }
  assertNonNegativeInt(orderDiscountCents, 'Desconto do pedido');

  const results = lines.map((line, index) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new OrderCalculationError(`Item ${index + 1}: quantidade deve ser um inteiro maior que zero.`);
    }
    assertNonNegativeInt(line.unitPriceCents, `Item ${index + 1}: preço unitário`);
    assertNonNegativeInt(line.discountCents, `Item ${index + 1}: desconto`);
    const grossCents = line.quantity * line.unitPriceCents;
    if (line.discountCents > grossCents) {
      throw new OrderCalculationError(`Item ${index + 1}: o desconto não pode ser maior que o valor do item.`);
    }
    return { ...line, grossCents, totalCents: grossCents - line.discountCents };
  });

  const subtotalCents = results.reduce((sum, l) => sum + l.totalCents, 0);
  if (orderDiscountCents > subtotalCents) {
    throw new OrderCalculationError('O desconto do pedido não pode ser maior que o subtotal.');
  }
  if (!Number.isSafeInteger(subtotalCents)) {
    throw new OrderCalculationError('Valor do pedido excede o limite permitido.');
  }

  return {
    lines: results,
    subtotalCents,
    discountCents: orderDiscountCents,
    totalCents: subtotalCents - orderDiscountCents,
  };
}

export function formatOrderNumber(number: number): string {
  return `PED-${String(number).padStart(5, '0')}`;
}
