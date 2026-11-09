import { beforeAll, describe, expect, it } from 'vitest';
import { createCustomer, createOrder, createOrganization, createProduct, type Agent } from '../helpers';

describe('Clientes', () => {
  let admin: Agent;
  beforeAll(async () => {
    ({ admin } = await createOrganization('Clientes S.A.'));
  });

  it('cria cliente completo normalizando os dados', async () => {
    const res = await admin
      .post('/customers')
      .send({
        type: 'COMPANY',
        name: 'Padaria Sol Nascente LTDA',
        email: 'Contato@Padaria.com.br',
        phone: '(11) 98888-7777',
        document: '11.222.333/0001-81',
        zipCode: '01310-100',
        street: 'Av. Paulista',
        number: '1000',
        city: 'São Paulo',
        state: 'sp',
        notes: 'Entrega pela manhã',
      })
      .expect(201);
    expect(res.body.data).toMatchObject({
      email: 'contato@padaria.com.br',
      document: '11222333000181',
      zipCode: '01310100',
      state: 'SP',
    });
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('valida CPF/CNPJ e campos obrigatórios', async () => {
    const res = await admin.post('/customers').send({ type: 'INDIVIDUAL', name: 'Ana', document: '123.456.789-00' }).expect(400);
    expect(res.body.error.details.fieldErrors.document).toContain('CPF inválido.');
    await admin.post('/customers').send({ type: 'INDIVIDUAL', name: '' }).expect(400);
    await admin.post('/customers').send({ type: 'ALIEN', name: 'Ana' }).expect(400);
  });

  it('impede CPF duplicado na mesma organização', async () => {
    await createCustomer(admin, { document: '529.982.247-25', name: 'Primeiro' });
    const res = await admin.post('/customers').send({ type: 'INDIVIDUAL', name: 'Segundo', document: '52998224725' }).expect(409);
    expect(res.body.error.message).toMatch(/CPF\/CNPJ/);
  });

  it('pesquisa, filtra e pagina', async () => {
    const { admin: a } = await createOrganization('Paginação');
    for (let i = 1; i <= 12; i++) {
      await createCustomer(a, { name: `Cliente ${String(i).padStart(2, '0')}`, type: i % 3 === 0 ? 'COMPANY' : 'INDIVIDUAL' });
    }
    await createCustomer(a, { name: 'Beatriz Horizonte' });

    const page2 = await a.get('/customers?page=2&pageSize=5&sort=name&order=asc').expect(200);
    expect(page2.body.meta).toEqual({ page: 2, pageSize: 5, total: 13, totalPages: 3 });
    // 'Beatriz Horizonte' é o primeiro em ordem alfabética, então a página 2 começa em 'Cliente 05'
    expect(page2.body.data[0].name).toBe('Cliente 05');

    const search = await a.get('/customers?search=horiz').expect(200);
    expect(search.body.data).toHaveLength(1);

    const companies = await a.get('/customers?type=COMPANY').expect(200);
    expect(companies.body.meta.total).toBe(4);

    await a.get('/customers?pageSize=1000').expect(400);
  });

  it('consulta, edita e exclui com estatísticas', async () => {
    const customer = await createCustomer(admin, { name: 'Para Editar' });
    const updated = await admin.put(`/customers/${customer.id}`).send({ type: 'INDIVIDUAL', name: 'Editado', city: 'Recife' }).expect(200);
    expect(updated.body.data).toMatchObject({ name: 'Editado', city: 'Recife' });

    const detail = await admin.get(`/customers/${customer.id}`).expect(200);
    expect(detail.body.data.stats).toEqual({ ordersCount: 0, totalSpentCents: 0, lastOrderAt: null });

    await admin.delete(`/customers/${customer.id}`).expect(204);
    await admin.get(`/customers/${customer.id}`).expect(404);
  });

  it('não exclui cliente com pedidos (preserva histórico)', async () => {
    const customer = await createCustomer(admin, { name: 'Com pedido' });
    const product = await createProduct(admin);
    await createOrder(admin, customer.id, [{ productId: product.id, quantity: 1 }]);
    const res = await admin.delete(`/customers/${customer.id}`).expect(409);
    expect(res.body.error.message).toMatch(/pedido/);
    const orders = await admin.get(`/orders?customerId=${customer.id}`).expect(200);
    expect(orders.body.meta.total).toBe(1);
  });

  it('retorna 404 para id malformado', async () => {
    await admin.get('/customers/nao-e-uuid').expect(404);
  });
});
