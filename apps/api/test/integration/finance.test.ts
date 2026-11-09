import { beforeEach, describe, expect, it } from 'vitest';
import { createCustomer, createOrder, createOrganization, createProduct, setStatus, type Agent } from '../helpers';

const entry = (overrides: Record<string, unknown> = {}) => ({
  type: 'EXPENSE',
  description: 'Aluguel',
  category: 'Despesas fixas',
  amountCents: 150_000,
  dueDate: '2026-01-10',
  ...overrides,
});

describe('Financeiro', () => {
  let admin: Agent;
  beforeEach(async () => {
    ({ admin } = await createOrganization('Financeiro LTDA'));
  });

  it('cria receitas e despesas e calcula saldo, resultado e pendências', async () => {
    await admin.post('/finance/entries').send(entry({ type: 'INCOME', description: 'Consultoria', amountCents: 500_000, status: 'PAID', paidAt: '2026-01-05' })).expect(201);
    await admin.post('/finance/entries').send(entry({ status: 'PAID', paidAt: '2026-01-10' })).expect(201);
    await admin.post('/finance/entries').send(entry({ description: 'Energia', amountCents: 30_000, dueDate: '2099-01-01' })).expect(201);
    await admin.post('/finance/entries').send(entry({ type: 'INCOME', description: 'A receber', amountCents: 80_000, dueDate: '2020-01-01' })).expect(201);

    const s = (await admin.get('/finance/summary?from=2026-01-01&to=2026-01-31').expect(200)).body.data;
    expect(s.incomeCents).toBe(500_000);
    expect(s.expenseCents).toBe(150_000);
    expect(s.resultCents).toBe(350_000);
    expect(s.balanceCents).toBe(350_000);
    expect(s.payable).toMatchObject({ cents: 30_000, count: 1, overdueCount: 0 });
    expect(s.receivable).toMatchObject({ cents: 80_000, count: 1, overdueCents: 80_000, overdueCount: 1 });

    const overdue = (await admin.get('/finance/entries?overdue=true').expect(200)).body;
    expect(overdue.meta.total).toBe(1);
    expect(overdue.data[0]).toMatchObject({ description: 'A receber', overdue: true });

    const flow = (await admin.get('/finance/cashflow?from=2026-01-01&to=2026-12-31').expect(200)).body.data;
    expect(flow).toEqual([{ month: '2026-01', incomeCents: 500_000, expenseCents: 150_000 }]);
  });

  it('baixa, cancela, edita e exclui lançamentos manuais respeitando as regras', async () => {
    const created = (await admin.post('/finance/entries').send(entry()).expect(201)).body.data;
    expect(created).toMatchObject({ status: 'PENDING', dueDate: '2026-01-10', paidAt: null, locked: false });

    const edited = (await admin.put(`/finance/entries/${created.id}`).send(entry({ amountCents: 160_000 })).expect(200)).body.data;
    expect(edited.amountCents).toBe(160_000);

    const paid = (await admin.post(`/finance/entries/${created.id}/pay`).send({ paidAt: '2026-01-11' }).expect(200)).body.data;
    expect(paid).toMatchObject({ status: 'PAID', paidAt: '2026-01-11' });

    await admin.put(`/finance/entries/${created.id}`).send(entry()).expect(422);
    await admin.post(`/finance/entries/${created.id}/pay`).send({}).expect(422);
    const del = await admin.delete(`/finance/entries/${created.id}`).expect(422);
    expect(del.body.error.message).toMatch(/Cancele/);

    await admin.post(`/finance/entries/${created.id}/cancel`).expect(200);
    expect((await admin.get('/finance/summary')).body.data.balanceCents).toBe(0);

    const pending = (await admin.post('/finance/entries').send(entry()).expect(201)).body.data;
    await admin.delete(`/finance/entries/${pending.id}`).expect(204);
  });

  it('valida valores (inteiro positivo em centavos) e datas', async () => {
    await admin.post('/finance/entries').send(entry({ amountCents: 0 })).expect(400);
    await admin.post('/finance/entries').send(entry({ amountCents: 10.5 })).expect(400);
    await admin.post('/finance/entries').send(entry({ dueDate: '10/01/2026' })).expect(400);
    await admin.post('/finance/entries').send(entry({ type: 'TRANSFER' })).expect(400);
  });

  it('lançamentos gerados por pedidos não podem ser alterados manualmente', async () => {
    const c = await createCustomer(admin);
    const p = await createProduct(admin);
    const order = await createOrder(admin, c.id, [{ productId: p.id, quantity: 1 }]);
    await setStatus(admin, order.id, 'AWAITING_PAYMENT').expect(200);
    const list = (await admin.get('/finance/entries?type=INCOME').expect(200)).body.data;
    const linked = list[0];
    expect(linked).toMatchObject({ locked: true, category: 'Vendas', amountCents: 10_000 });
    expect(linked.order.number).toBe(order.number);

    for (const req of [
      admin.put(`/finance/entries/${linked.id}`).send(entry()),
      admin.post(`/finance/entries/${linked.id}/pay`).send({}),
      admin.post(`/finance/entries/${linked.id}/cancel`),
      admin.delete(`/finance/entries/${linked.id}`),
    ]) {
      const res = await req.expect(422);
      expect(res.body.error.code).toBe('ENTRY_LOCKED');
    }
  });
});
