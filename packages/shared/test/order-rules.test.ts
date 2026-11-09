import { describe, expect, it } from 'vitest';
import {
  calculateOrderTotals,
  canTransition,
  formatOrderNumber,
  isOrderEditable,
  isOrderFinal,
  OrderCalculationError,
  ORDER_STATUSES,
} from '../src';

describe('calculateOrderTotals', () => {
  it('soma itens e aplica descontos de item e de pedido em centavos', () => {
    const totals = calculateOrderTotals(
      [
        { quantity: 3, unitPriceCents: 1990, discountCents: 0 },
        { quantity: 2, unitPriceCents: 15000, discountCents: 2500 },
      ],
      470,
    );
    expect(totals.lines[0]!.totalCents).toBe(5970);
    expect(totals.lines[1]!.totalCents).toBe(27500);
    expect(totals.subtotalCents).toBe(33470);
    expect(totals.totalCents).toBe(33000);
  });

  it('não sofre erro de ponto flutuante (0,1 + 0,2)', () => {
    const totals = calculateOrderTotals([
      { quantity: 1, unitPriceCents: 10, discountCents: 0 },
      { quantity: 1, unitPriceCents: 20, discountCents: 0 },
    ]);
    expect(totals.totalCents).toBe(30);
  });

  it('rejeita pedido sem itens', () => {
    expect(() => calculateOrderTotals([])).toThrow(OrderCalculationError);
  });

  it('rejeita desconto de item maior que o valor do item', () => {
    expect(() => calculateOrderTotals([{ quantity: 1, unitPriceCents: 100, discountCents: 101 }])).toThrow(
      /desconto não pode ser maior/,
    );
  });

  it('rejeita desconto do pedido maior que o subtotal', () => {
    expect(() => calculateOrderTotals([{ quantity: 1, unitPriceCents: 100, discountCents: 0 }], 200)).toThrow(
      /subtotal/,
    );
  });

  it('rejeita quantidades e valores inválidos', () => {
    expect(() => calculateOrderTotals([{ quantity: 0, unitPriceCents: 100, discountCents: 0 }])).toThrow();
    expect(() => calculateOrderTotals([{ quantity: 1.5, unitPriceCents: 100, discountCents: 0 }])).toThrow();
    expect(() => calculateOrderTotals([{ quantity: 1, unitPriceCents: -1, discountCents: 0 }])).toThrow();
    expect(() => calculateOrderTotals([{ quantity: 1, unitPriceCents: 10.5, discountCents: 0 }])).toThrow();
  });

  it('permite desconto total (pedido zerado)', () => {
    const totals = calculateOrderTotals([{ quantity: 1, unitPriceCents: 100, discountCents: 100 }]);
    expect(totals.totalCents).toBe(0);
  });
});

describe('máquina de estados do pedido', () => {
  it('segue o fluxo principal', () => {
    expect(canTransition('QUOTE', 'AWAITING_PAYMENT')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'PAID')).toBe(true);
    expect(canTransition('PAID', 'PROCESSING')).toBe(true);
    expect(canTransition('PROCESSING', 'COMPLETED')).toBe(true);
  });

  it('não permite pular etapas', () => {
    expect(canTransition('QUOTE', 'PAID')).toBe(false);
    expect(canTransition('QUOTE', 'COMPLETED')).toBe(false);
    expect(canTransition('AWAITING_PAYMENT', 'COMPLETED')).toBe(false);
  });

  it('estados finais não possuem transições', () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition('COMPLETED', to)).toBe(false);
      expect(canTransition('CANCELED', to)).toBe(false);
    }
    expect(isOrderFinal('COMPLETED')).toBe(true);
    expect(isOrderFinal('CANCELED')).toBe(true);
  });

  it('só permite edição antes do pagamento', () => {
    expect(isOrderEditable('QUOTE')).toBe(true);
    expect(isOrderEditable('AWAITING_PAYMENT')).toBe(true);
    expect(isOrderEditable('PAID')).toBe(false);
    expect(isOrderEditable('COMPLETED')).toBe(false);
  });

  it('formata o número do pedido', () => {
    expect(formatOrderNumber(42)).toBe('PED-00042');
  });
});
