import { randomUUID } from 'node:crypto';
import type { Role } from '@horizons/shared';
import request from 'supertest';
import { createApp } from '../src/app';

export const app = createApp({ rateLimit: false });
export const PASSWORD = 'Senha@Teste1';

export type Agent = ReturnType<typeof request.agent>;

export const uniqueEmail = (prefix = 'user') => `${prefix}.${randomUUID().slice(0, 8)}@teste.dev`;

/** Cria uma organização (via cadastro público) e retorna o agente autenticado do administrador. */
export async function createOrganization(name = 'Empresa Teste') {
  const admin = request.agent(app);
  const email = uniqueEmail('admin');
  const res = await admin
    .post('/auth/register')
    .send({ organizationName: name, name: 'Admin Teste', email, password: PASSWORD })
    .expect(201);
  return { admin, adminUser: res.body.data as { id: string; organization: { id: string } }, email };
}

/** Cria um usuário com a função indicada na organização do admin e retorna seu agente autenticado. */
export async function createMember(admin: Agent, role: Role) {
  const email = uniqueEmail(role.toLowerCase());
  const created = await admin.post('/users').send({ name: `${role} Teste`, email, role, password: PASSWORD }).expect(201);
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { agent, user: created.body.data as { id: string }, email };
}

export async function createCustomer(agent: Agent, overrides: Record<string, unknown> = {}) {
  const res = await agent
    .post('/customers')
    .send({ type: 'INDIVIDUAL', name: 'Cliente Teste', email: 'cliente@teste.dev', ...overrides })
    .expect(201);
  return res.body.data as { id: string; name: string };
}

export async function createProduct(agent: Agent, overrides: Record<string, unknown> = {}) {
  const res = await agent
    .post('/products')
    .send({
      type: 'PRODUCT',
      name: 'Produto Teste',
      sku: `SKU-${randomUUID().slice(0, 6)}`,
      category: 'Geral',
      priceCents: 10_000,
      stock: 10,
      minStock: 2,
      ...overrides,
    })
    .expect(201);
  return res.body.data as { id: string; sku: string; stock: number; priceCents: number };
}

export async function createOrder(
  agent: Agent,
  customerId: string,
  items: { productId: string; quantity: number; discountCents?: number }[],
  discountCents = 0,
) {
  const res = await agent.post('/orders').send({ customerId, items, discountCents }).expect(201);
  return res.body.data as { id: string; number: number; status: string; totalCents: number; subtotalCents: number };
}

export const setStatus = (agent: Agent, orderId: string, status: string) =>
  agent.patch(`/orders/${orderId}/status`).send({ status });
