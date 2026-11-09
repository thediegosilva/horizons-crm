import { beforeAll, describe, expect, it } from 'vitest';
import { createCustomer, createMember, createOrder, createOrganization, createProduct, setStatus, type Agent } from '../helpers';

/**
 * Isolamento multiempresa: a organização B nunca enxerga nem altera dados da organização A,
 * mesmo conhecendo os identificadores (proteção contra IDOR / acesso horizontal).
 */
describe('Isolamento entre organizações', () => {
  let orgA: Agent;
  let orgB: Agent;
  const a = {} as { customerId: string; productId: string; orderId: string; entryId: string; userId: string; notificationId: string };

  beforeAll(async () => {
    orgA = (await createOrganization('Empresa A')).admin;
    orgB = (await createOrganization('Empresa B')).admin;

    a.customerId = (await createCustomer(orgA, { name: 'Cliente Secreto A', document: '529.982.247-25' })).id;
    a.productId = (await createProduct(orgA, { name: 'Produto Secreto A', stock: 1, minStock: 1 })).id;
    const manager = await createMember(orgA, 'MANAGER');
    a.userId = manager.user.id;
    a.orderId = (await createOrder(orgA, a.customerId, [{ productId: a.productId, quantity: 1 }])).id;
    await setStatus(orgA, a.orderId, 'AWAITING_PAYMENT').expect(200);
    const entries = (await orgA.get('/finance/entries').expect(200)).body.data;
    a.entryId = entries[0].id;
    a.notificationId = (await manager.agent.get('/notifications').expect(200)).body.data[0].id;
  });

  it('listagens não incluem dados de outra organização', async () => {
    for (const path of ['/customers', '/products', '/orders', '/finance/entries', '/users', '/activities']) {
      const body = (await orgB.get(path).expect(200)).body;
      const json = JSON.stringify(body);
      expect(json).not.toContain('Secreto A');
      expect(json).not.toContain(a.customerId);
    }
    const dash = (await orgB.get('/dashboard').expect(200)).body.data;
    expect(dash.customers.total).toBe(0);
    expect(dash.recentOrders).toHaveLength(0);
  });

  it('acesso direto por id retorna 404 (sem revelar existência)', async () => {
    await orgB.get(`/customers/${a.customerId}`).expect(404);
    await orgB.get(`/products/${a.productId}`).expect(404);
    await orgB.get(`/orders/${a.orderId}`).expect(404);
    await orgB.get(`/finance/entries/${a.entryId}`).expect(404);
  });

  it('não altera nem exclui recursos de outra organização', async () => {
    await orgB.put(`/customers/${a.customerId}`).send({ type: 'INDIVIDUAL', name: 'Invadido' }).expect(404);
    await orgB.delete(`/customers/${a.customerId}`).expect(404);
    await orgB
      .put(`/products/${a.productId}`)
      .send({ type: 'PRODUCT', name: 'Invadido', sku: 'HACK', category: 'Invasão', priceCents: 1 })
      .expect(404);
    await orgB.delete(`/products/${a.productId}`).expect(404);
    await setStatus(orgB, a.orderId, 'CANCELED').expect(404);
    await orgB.delete(`/orders/${a.orderId}`).expect(404);
    await orgB.post(`/finance/entries/${a.entryId}/pay`).send({}).expect(404);
    await orgB.patch(`/users/${a.userId}`).send({ role: 'OPERATOR', active: false }).expect(404);
    await orgB.post(`/users/${a.userId}/password`).send({ password: 'Invadido123' }).expect(404);
    await orgB.post(`/notifications/${a.notificationId}/read`).expect(404);

    // Dados originais intactos
    expect((await orgA.get(`/customers/${a.customerId}`).expect(200)).body.data.name).toBe('Cliente Secreto A');
    expect((await orgA.get(`/orders/${a.orderId}`).expect(200)).body.data.status).toBe('AWAITING_PAYMENT');
  });

  it('não cria pedidos usando cliente ou produto de outra organização', async () => {
    const myCustomer = await createCustomer(orgB);
    const myProduct = await createProduct(orgB);
    const r1 = await orgB.post('/orders').send({ customerId: a.customerId, items: [{ productId: myProduct.id, quantity: 1 }] }).expect(422);
    expect(r1.body.error.code).toBe('INVALID_CUSTOMER');
    const r2 = await orgB.post('/orders').send({ customerId: myCustomer.id, items: [{ productId: a.productId, quantity: 1 }] }).expect(422);
    expect(r2.body.error.code).toBe('INVALID_PRODUCT');
  });

  it('o mesmo CPF pode existir em organizações diferentes', async () => {
    await createCustomer(orgB, { document: '529.982.247-25' });
  });

  it('ignora tentativa de injetar organizationId no corpo', async () => {
    const res = await orgB
      .post('/customers')
      .send({ type: 'INDIVIDUAL', name: 'Injeção', organizationId: '00000000-0000-4000-8000-000000000000' })
      .expect(201);
    const listA = JSON.stringify((await orgA.get('/customers').expect(200)).body);
    expect(listA).not.toContain(res.body.data.id);
  });

  it('pesquisa com caracteres especiais não causa SQL Injection', async () => {
    const res = await orgB.get(`/customers?search=${encodeURIComponent("' OR 1=1 --")}`).expect(200);
    expect(res.body.data).toHaveLength(0);
  });
});
