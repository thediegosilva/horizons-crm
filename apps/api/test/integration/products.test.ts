import { beforeAll, describe, expect, it } from 'vitest';
import { createCustomer, createOrder, createOrganization, createProduct, type Agent } from '../helpers';

describe('Produtos e serviços', () => {
  let admin: Agent;
  beforeAll(async () => {
    ({ admin } = await createOrganization('Produtos LTDA'));
  });

  it('cria produto com SKU normalizado', async () => {
    const res = await admin
      .post('/products')
      .send({ type: 'PRODUCT', name: 'Cadeira Ergonômica', sku: 'cad-ergo-01', category: 'Móveis', priceCents: 89_990, stock: 15, minStock: 3 })
      .expect(201);
    expect(res.body.data).toMatchObject({ sku: 'CAD-ERGO-01', priceCents: 89_990, active: true });
  });

  it('serviços não controlam estoque', async () => {
    const res = await admin
      .post('/products')
      .send({ type: 'SERVICE', name: 'Instalação', sku: 'SRV-INST', category: 'Serviços', priceCents: 15_000, stock: 99 })
      .expect(201);
    expect(res.body.data.stock).toBe(0);
  });

  it('valida preço e estoque', async () => {
    await admin.post('/products').send({ type: 'PRODUCT', name: 'X', sku: 'X1', category: 'Geral', priceCents: -1 }).expect(400);
    await admin.post('/products').send({ type: 'PRODUCT', name: 'Xis', sku: 'X1', category: 'Geral', priceCents: 10.5 }).expect(400);
    await admin.post('/products').send({ type: 'PRODUCT', name: 'Xis', sku: 'X 1', category: 'Geral', priceCents: 100 }).expect(400);
  });

  it('SKU é único por organização, mas pode repetir entre organizações', async () => {
    await createProduct(admin, { sku: 'UNICO-1' });
    const dup = await admin.post('/products').send({ type: 'PRODUCT', name: 'Outro', sku: 'unico-1', category: 'Geral', priceCents: 100 }).expect(409);
    expect(dup.body.error.message).toMatch(/SKU/);
    const { admin: other } = await createOrganization('Outra');
    await createProduct(other, { sku: 'UNICO-1' });
  });

  it('filtra por estoque baixo, categoria, status e pesquisa', async () => {
    const { admin: a } = await createOrganization('Filtros');
    await createProduct(a, { name: 'Caneta Azul', category: 'Papelaria', stock: 1, minStock: 5 });
    await createProduct(a, { name: 'Caderno', category: 'Papelaria', stock: 50, minStock: 5 });
    await createProduct(a, { name: 'Mouse', category: 'Informática', stock: 0, minStock: 0, active: false });

    expect((await a.get('/products?lowStock=true').expect(200)).body.meta.total).toBe(2);
    expect((await a.get('/products?category=Papelaria').expect(200)).body.meta.total).toBe(2);
    expect((await a.get('/products?active=false').expect(200)).body.data[0].name).toBe('Mouse');
    expect((await a.get('/products?search=caneta').expect(200)).body.meta.total).toBe(1);
    expect((await a.get('/products/categories').expect(200)).body.data).toEqual(['Informática', 'Papelaria']);
  });

  it('edita e exclui produto não utilizado', async () => {
    const p = await createProduct(admin);
    const res = await admin
      .put(`/products/${p.id}`)
      .send({ type: 'PRODUCT', name: 'Renomeado', sku: p.sku, category: 'Nova', priceCents: 5000, stock: 3, minStock: 1, active: false })
      .expect(200);
    expect(res.body.data).toMatchObject({ name: 'Renomeado', active: false, priceCents: 5000 });
    await admin.delete(`/products/${p.id}`).expect(204);
    await admin.get(`/products/${p.id}`).expect(404);
  });

  it('não exclui produto já vendido e sugere desativação', async () => {
    const p = await createProduct(admin);
    const c = await createCustomer(admin);
    await createOrder(admin, c.id, [{ productId: p.id, quantity: 1 }]);
    const res = await admin.delete(`/products/${p.id}`).expect(409);
    expect(res.body.error.message).toMatch(/Desative/);
  });
});
