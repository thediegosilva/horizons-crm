import { beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env';
import { todayInTz } from '../../src/lib/dates';
import { createCustomer, createOrder, createOrganization, createProduct, setStatus, type Agent } from '../helpers';

describe('Dashboard e relatórios', () => {
  let admin: Agent;
  const today = todayInTz(env.APP_TIMEZONE);

  beforeAll(async () => {
    ({ admin } = await createOrganization('Indicadores'));
    const c1 = await createCustomer(admin, { name: 'Ana' });
    const c2 = await createCustomer(admin, { name: '=CMD()' });
    const p1 = await createProduct(admin, { name: 'Notebook', priceCents: 400_000, stock: 10 });
    const p2 = await createProduct(admin, { name: 'Mouse', priceCents: 10_000, stock: 50 });

    const o1 = await createOrder(admin, c1.id, [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 2 }]);
    for (const s of ['AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED']) await setStatus(admin, o1.id, s).expect(200);
    const o2 = await createOrder(admin, c2.id, [{ productId: p2.id, quantity: 5 }]);
    for (const s of ['AWAITING_PAYMENT', 'PAID']) await setStatus(admin, o2.id, s).expect(200);
    await createOrder(admin, c2.id, [{ productId: p2.id, quantity: 1 }]); // orçamento
    const o4 = await createOrder(admin, c1.id, [{ productId: p2.id, quantity: 1 }]);
    await setStatus(admin, o4.id, 'CANCELED').expect(200);
  });

  it('dashboard reflete os dados reais do banco', async () => {
    const d = (await admin.get('/dashboard').expect(200)).body.data;
    expect(d.customers).toEqual({ total: 2, newThisMonth: 2 });
    expect(d.sales).toEqual({ total: 2, thisMonth: 2 });
    expect(d.revenue.monthCents).toBe(470_000);
    expect(d.pendingOrders.total).toBe(2); // 1 orçamento + 1 pago
    expect(d.pendingOrders.byStatus).toEqual({ QUOTE: 1, PAID: 1 });
    expect(d.kpis.averageTicketCents).toBe(235_000);
    expect(d.kpis.conversionRatePct).toBe(50);
    expect(d.kpis.cancellationRatePct).toBe(25);
    expect(d.monthly).toHaveLength(12);
    expect(d.monthly[11]).toEqual({ period: today.slice(0, 7), orders: 2, revenueCents: 470_000 });
    expect(d.daily).toHaveLength(30);
    expect(d.daily[29]).toMatchObject({ period: today, revenueCents: 470_000 });
    expect(d.recentOrders).toHaveLength(4);
    expect(d.activities.length).toBeGreaterThan(0);
  });

  it('relatório de vendas por período', async () => {
    const r = (await admin.get(`/reports/sales?from=${today}&to=${today}`).expect(200)).body.data;
    expect(r.totals).toEqual({ orders: 2, revenueCents: 470_000, averageTicketCents: 235_000 });
    expect(r.series).toHaveLength(1);
  });

  it('relatório de vendas soma descontos de item e de pedido', async () => {
    const { admin: a } = await createOrganization('Descontos');
    const c = await createCustomer(a);
    const p = await createProduct(a, { priceCents: 10_000 });
    const o = await createOrder(a, c.id, [{ productId: p.id, quantity: 2, discountCents: 1_500 }], 500);
    for (const s of ['AWAITING_PAYMENT', 'PAID']) await setStatus(a, o.id, s).expect(200);
    const r = (await a.get(`/reports/sales?from=${today}&to=${today}`).expect(200)).body.data;
    expect(r.series[0]).toMatchObject({ orders: 1, revenueCents: 18_000, discountCents: 2_000 });
  });

  it('produtos mais vendidos', async () => {
    const r = (await admin.get(`/reports/top-products?from=${today}&to=${today}`).expect(200)).body.data;
    expect(r.rows[0]).toMatchObject({ name: 'Mouse', quantity: 7, revenueCents: 70_000, orders: 2 });
    expect(r.rows[1]).toMatchObject({ name: 'Notebook', quantity: 1, revenueCents: 400_000 });
  });

  it('pedidos por status, clientes e faturamento', async () => {
    const s = (await admin.get(`/reports/orders-by-status?from=${today}&to=${today}`).expect(200)).body.data;
    expect(s.totals.count).toBe(4);
    expect(s.rows.find((r: { status: string }) => r.status === 'CANCELED').count).toBe(1);

    const c = (await admin.get(`/reports/customers?from=${today}&to=${today}&groupBy=month`).expect(200)).body.data;
    expect(c.totals.count).toBe(2);

    const f = (await admin.get(`/reports/revenue?from=${today}&to=${today}`).expect(200)).body.data;
    expect(f.totals).toEqual({ incomeCents: 470_000, expenseCents: 0, resultCents: 470_000 });
  });

  it('exporta CSV com separador ; e proteção contra injeção de fórmulas', async () => {
    const res = await admin.get(`/reports/customers/export?from=${today}&to=${today}`).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="horizons-customers-/);
    const text = res.text;
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toContain('Nome / Razão social;Tipo;E-mail');
    expect(text).toContain("'=CMD()");
    expect(text).not.toMatch(/^=CMD/m);

    const sales = await admin.get(`/reports/sales/export?from=${today}&to=${today}`).expect(200);
    expect(sales.text).toContain('4700,00');
  });

  it('valida tipo e período do relatório', async () => {
    await admin.get('/reports/inexistente?from=2026-01-01&to=2026-01-31').expect(400);
    await admin.get('/reports/sales?from=2026-02-01&to=2026-01-01').expect(400);
    await admin.get('/reports/sales?from=2020-01-01&to=2026-01-01').expect(400);
    await admin.get('/reports/sales').expect(400);
  });

  it('documentação OpenAPI disponível', async () => {
    const { app } = await import('../helpers');
    const request = (await import('supertest')).default;
    const doc = (await request(app).get('/openapi.json').expect(200)).body;
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/auth/login', '/customers', '/orders/{id}/status', '/reports/{type}/export']));
  });
});
