import { describe, expect, it } from 'vitest';
import {
  customerSchema,
  financialEntrySchema,
  hasPermission,
  isValidCnpj,
  isValidCpf,
  orderSchema,
  passwordSchema,
  productSchema,
  toCents,
} from '../src';

describe('documentos', () => {
  it('valida CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });
  it('valida CNPJ', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });
});

describe('schemas', () => {
  it('normaliza cliente e converte vazios em null', () => {
    const parsed = customerSchema.parse({
      type: 'INDIVIDUAL',
      name: '  Ana Souza ',
      email: 'ANA@EXEMPLO.COM',
      phone: '',
      document: '529.982.247-25',
      state: 'sp',
    });
    expect(parsed.name).toBe('Ana Souza');
    expect(parsed.email).toBe('ana@exemplo.com');
    expect(parsed.phone).toBeNull();
    expect(parsed.document).toBe('52998224725');
    expect(parsed.state).toBe('SP');
  });

  it('rejeita CNPJ inválido para pessoa jurídica', () => {
    const r = customerSchema.safeParse({ type: 'COMPANY', name: 'ACME', document: '52998224725' });
    expect(r.success).toBe(false);
  });

  it('exige senha forte', () => {
    expect(passwordSchema.safeParse('fraca').success).toBe(false);
    expect(passwordSchema.safeParse('semnumeroA').success).toBe(false);
    expect(passwordSchema.safeParse('Forte1234').success).toBe(true);
  });

  it('normaliza SKU e rejeita preço fracionado', () => {
    expect(productSchema.parse({ type: 'PRODUCT', name: 'Cadeira', sku: 'cad-01', category: 'Móveis', priceCents: 100 }).sku).toBe('CAD-01');
    expect(productSchema.safeParse({ type: 'PRODUCT', name: 'Cadeira', sku: 'X1', category: 'Móveis', priceCents: 1.5 }).success).toBe(false);
  });

  it('rejeita produto repetido no pedido', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const r = orderSchema.safeParse({ customerId: id, items: [{ productId: id, quantity: 1 }, { productId: id, quantity: 2 }] });
    expect(r.success).toBe(false);
  });

  it('define data de pagamento ao criar lançamento pago', () => {
    const r = financialEntrySchema.parse({ type: 'EXPENSE', description: 'Aluguel', category: 'Fixas', amountCents: 150000, dueDate: '2026-05-10', status: 'PAID' });
    expect(r.paidAt).toBe('2026-05-10');
    const p = financialEntrySchema.parse({ type: 'EXPENSE', description: 'Aluguel', category: 'Fixas', amountCents: 150000, dueDate: '2026-05-10', paidAt: '2026-05-01' });
    expect(p.paidAt).toBeNull();
  });

  it('converte reais para centavos com arredondamento correto', () => {
    expect(toCents(19.9)).toBe(1990);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});

describe('permissões', () => {
  it('aplica a matriz por função', () => {
    expect(hasPermission('ADMIN', 'users:manage')).toBe(true);
    expect(hasPermission('MANAGER', 'users:manage')).toBe(false);
    expect(hasPermission('MANAGER', 'finance:write')).toBe(true);
    expect(hasPermission('OPERATOR', 'finance:read')).toBe(false);
    expect(hasPermission('OPERATOR', 'customers:delete')).toBe(false);
    expect(hasPermission('OPERATOR', 'orders:write')).toBe(true);
  });
});
