import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { createCustomer, createOrder, createOrganization, createProduct, setStatus, type Agent } from '../helpers';

describe('Pedidos e vendas', () => {
  let admin: Agent;
  let customerId: string;

  beforeEach(async () => {
    ({ admin } = await createOrganization('Pedidos ME'));
    customerId = (await createCustomer(admin)).id;
  });

  it('calcula os totais no servidor usando o preço cadastrado (ignora valores do cliente)', async () => {
    const a = await createProduct(admin, { priceCents: 1_990 });
    const b = await createProduct(admin, { priceCents: 15_000 });
    const res = await admin
      .post('/orders')
      .send({
        customerId,
        items: [
          { productId: a.id, quantity: 3, unitPriceCents: 1 },
          { productId: b.id, quantity: 2, discountCents: 2_500 },
        ],
        discountCents: 470,
        totalCents: 1,
      })
      .expect(201);
    const order = res.body.data;
    expect(order).toMatchObject({ status: 'QUOTE', subtotalCents: 33_470, discountCents: 470, totalCents: 33_000, code: 'PED-00001' });
    expect(order.items.find((i: { productId: string }) => i.productId === a.id)).toMatchObject({ unitPriceCents: 1_990, totalCents: 5_970 });
    expect(order.statusHistory).toHaveLength(1);
  });

  it('numera pedidos sequencialmente por organização', async () => {
    const p = await createProduct(admin);
    const o1 = await createOrder(admin, customerId, [{ productId: p.id, quantity: 1 }]);
    const o2 = await createOrder(admin, customerId, [{ productId: p.id, quantity: 1 }]);
    expect([o1.number, o2.number]).toEqual([1, 2]);
    const { admin: other } = await createOrganization();
    const c = await createCustomer(other);
    const p2 = await createProduct(other);
    expect((await createOrder(other, c.id, [{ productId: p2.id, quantity: 1 }])).number).toBe(1);
  });

  it('rejeita descontos inconsistentes, produto inativo e itens repetidos', async () => {
    const p = await createProduct(admin, { priceCents: 1_000 });
    const r1 = await admin.post('/orders').send({ customerId, items: [{ productId: p.id, quantity: 1, discountCents: 2_000 }] }).expect(422);
    expect(r1.body.error.code).toBe('INVALID_TOTALS');
    await admin.post('/orders').send({ customerId, items: [{ productId: p.id, quantity: 1 }], discountCents: 5_000 }).expect(422);
    await admin.post('/orders').send({ customerId, items: [{ productId: p.id, quantity: 1 }, { productId: p.id, quantity: 1 }] }).expect(400);
    await admin.post('/orders').send({ customerId, items: [] }).expect(400);
    const inactive = await createProduct(admin, { active: false });
    const r2 = await admin.post('/orders').send({ customerId, items: [{ productId: inactive.id, quantity: 1 }] }).expect(422);
    expect(r2.body.error.code).toBe('INACTIVE_PRODUCT');
  });

  it('fluxo completo: reserva estoque, gera conta a receber, baixa no pagamento e conclui', async () => {
    const p = await createProduct(admin, { priceCents: 5_000, stock: 10 });
    const s = await createProduct(admin, { type: 'SERVICE', priceCents: 2_000 });
    const order = await createOrder(admin, customerId, [
      { productId: p.id, quantity: 4 },
      { productId: s.id, quantity: 1 },
    ]);
    expect(order.totalCents).toBe(22_000);

    const awaiting = await setStatus(admin, order.id, 'AWAITING_PAYMENT').expect(200);
    expect(awaiting.body.data.stockReserved).toBe(true);
    expect(awaiting.body.data.financialEntries).toHaveLength(1);
    expect(awaiting.body.data.financialEntries[0]).toMatchObject({ type: 'INCOME', status: 'PENDING', amountCents: 22_000 });
    expect((await admin.get(`/products/${p.id}`)).body.data.stock).toBe(6);

    const paid = await setStatus(admin, order.id, 'PAID').expect(200);
    expect(paid.body.data.paidAt).not.toBeNull();
    expect(paid.body.data.financialEntries[0].status).toBe('PAID');

    await setStatus(admin, order.id, 'PROCESSING').expect(200);
    const done = await setStatus(admin, order.id, 'COMPLETED').expect(200);
    expect(done.body.data.completedAt).not.toBeNull();
    expect(done.body.data.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual([
      'QUOTE', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED',
    ]);

    const summary = await admin.get('/finance/summary').expect(200);
    expect(summary.body.data.incomeCents).toBe(22_000);
    expect(summary.body.data.balanceCents).toBe(22_000);
  });

  it('bloqueia alterações em pedidos concluídos e cancelados', async () => {
    const p = await createProduct(admin);
    const order = await createOrder(admin, customerId, [{ productId: p.id, quantity: 1 }]);
    for (const s of ['AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED']) await setStatus(admin, order.id, s).expect(200);

    const edit = await admin.put(`/orders/${order.id}`).send({ customerId, items: [{ productId: p.id, quantity: 5 }] }).expect(422);
    expect(edit.body.error.code).toBe('ORDER_LOCKED');
    const cancel = await setStatus(admin, order.id, 'CANCELED').expect(422);
    expect(cancel.body.error.code).toBe('INVALID_TRANSITION');

    const other = await createOrder(admin, customerId, [{ productId: p.id, quantity: 1 }]);
    await setStatus(admin, other.id, 'CANCELED').expect(200);
    await setStatus(admin, other.id, 'QUOTE').expect(422);
    await admin.put(`/orders/${other.id}`).send({ customerId, items: [{ productId: p.id, quantity: 2 }] }).expect(422);
  });

  it('não permite pular etapas do fluxo', async () => {
    const p = await createProduct(admin);
    const order = await createOrder(admin, customerId, [{ productId: p.id, quantity: 1 }]);
    await setStatus(admin, order.id, 'PAID').expect(422);
    await setStatus(admin, order.id, 'COMPLETED').expect(422);
    await setStatus(admin, order.id, 'QUOTE').expect(422);
  });

  it('impede venda sem estoque e desfaz a transação inteira', async () => {
    const ok = await createProduct(admin, { stock: 10 });
    const low = await createProduct(admin, { stock: 2 });
    const order = await createOrder(admin, customerId, [
      { productId: ok.id, quantity: 5 },
      { productId: low.id, quantity: 3 },
    ]);
    const res = await setStatus(admin, order.id, 'AWAITING_PAYMENT').expect(409);
    expect(res.body.error.message).toMatch(/Estoque insuficiente/);

    // Nada foi alterado: status, estoque e financeiro permanecem como antes.
    expect((await admin.get(`/orders/${order.id}`)).body.data.status).toBe('QUOTE');
    expect((await admin.get(`/products/${ok.id}`)).body.data.stock).toBe(10);
    expect(await prisma.financialEntry.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('cancelamento de pedido pago devolve o estoque e registra o estorno', async () => {
    const p = await createProduct(admin, { priceCents: 3_000, stock: 5 });
    const order = await createOrder(admin, customerId, [{ productId: p.id, quantity: 2 }]);
    await setStatus(admin, order.id, 'AWAITING_PAYMENT').expect(200);
    await setStatus(admin, order.id, 'PAID').expect(200);
    expect((await admin.get(`/products/${p.id}`)).body.data.stock).toBe(3);

    const canceled = await setStatus(admin, order.id, 'CANCELED').expect(200);
    expect(canceled.body.data.canceledAt).not.toBeNull();
    expect((await admin.get(`/products/${p.id}`)).body.data.stock).toBe(5);
    const entries = canceled.body.data.financialEntries;
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'INCOME', status: 'PAID', amountCents: 6_000 }),
        expect.objectContaining({ type: 'EXPENSE', status: 'PAID', amountCents: 6_000 }),
      ]),
    );
    const summary = await admin.get('/finance/summary').expect(200);
    expect(summary.body.data.balanceCents).toBe(0);
  });

  it('cancelamento antes do pagamento cancela a conta a receber', async () => {
    const p = await createProduct(admin, { stock: 5 });
    const order = await createOrder(admin, customerId, [{ productId: p.id, quantity: 1 }]);
    await setStatus(admin, order.id, 'AWAITING_PAYMENT').expect(200);
    const res = await setStatus(admin, order.id, 'CANCELED').expect(200);
    expect(res.body.data.financialEntries).toEqual([expect.objectContaining({ type: 'INCOME', status: 'CANCELED' })]);
    expect((await admin.get('/finance/summary')).body.data.receivable.cents).toBe(0);
  });

  it('editar pedido aguardando pagamento reajusta estoque e conta a receber', async () => {
    const p = await createProduct(admin, { priceCents: 1_000, stock: 10 });
    const order = await createOrder(admin, customerId, [{ productId: p.id, quantity: 2 }]);
    await setStatus(admin, order.id, 'AWAITING_PAYMENT').expect(200);
    expect((await admin.get(`/products/${p.id}`)).body.data.stock).toBe(8);

    const res = await admin.put(`/orders/${order.id}`).send({ customerId, items: [{ productId: p.id, quantity: 5 }] }).expect(200);
    expect(res.body.data.totalCents).toBe(5_000);
    expect(res.body.data.financialEntries[0]).toMatchObject({ status: 'PENDING', amountCents: 5_000 });
    expect((await admin.get(`/products/${p.id}`)).body.data.stock).toBe(5);
  });

  it('voltar para orçamento devolve o estoque', async () => {
    const p = await createProduct(admin, { stock: 4 });
    const order = await createOrder(admin, customerId, [{ productId: p.id, quantity: 4 }]);
    await setStatus(admin, order.id, 'AWAITING_PAYMENT').expect(200);
    expect((await admin.get(`/products/${p.id}`)).body.data.stock).toBe(0);
    await setStatus(admin, order.id, 'QUOTE').expect(200);
    expect((await admin.get(`/products/${p.id}`)).body.data.stock).toBe(4);
  });

  it('gera notificação de estoque baixo para gerentes e administradores', async () => {
    const p = await createProduct(admin, { name: 'Item Crítico', stock: 3, minStock: 2 });
    const order = await createOrder(admin, customerId, [{ productId: p.id, quantity: 2 }]);
    const { createMember } = await import('../helpers');
    const manager = await createMember(admin, 'MANAGER');
    await setStatus(admin, order.id, 'AWAITING_PAYMENT').expect(200);
    const res = await manager.agent.get('/notifications').expect(200);
    expect(res.body.meta.unread).toBeGreaterThan(0);
    expect(res.body.data[0]).toMatchObject({ title: 'Estoque baixo' });
    await manager.agent.post('/notifications/read-all').expect(204);
    expect((await manager.agent.get('/notifications')).body.meta.unread).toBe(0);
  });

  it('exclui somente orçamentos; filtra e pesquisa pedidos', async () => {
    const p = await createProduct(admin);
    const quote = await createOrder(admin, customerId, [{ productId: p.id, quantity: 1 }]);
    const confirmed = await createOrder(admin, customerId, [{ productId: p.id, quantity: 1 }]);
    await setStatus(admin, confirmed.id, 'AWAITING_PAYMENT').expect(200);

    expect((await admin.get('/orders?status=AWAITING_PAYMENT')).body.meta.total).toBe(1);
    expect((await admin.get(`/orders?search=${confirmed.number}`)).body.data[0].id).toBe(confirmed.id);
    expect((await admin.get('/orders?search=Cliente Teste')).body.meta.total).toBe(2);

    await admin.delete(`/orders/${confirmed.id}`).expect(422);
    await admin.delete(`/orders/${quote.id}`).expect(204);
  });
});
