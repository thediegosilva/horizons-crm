import { beforeAll, describe, expect, it } from 'vitest';
import { createCustomer, createMember, createOrder, createOrganization, createProduct, PASSWORD, setStatus, uniqueEmail, type Agent } from '../helpers';

describe('Permissões por função (RBAC no servidor)', () => {
  let admin: Agent;
  let manager: Agent;
  let operator: Agent;
  let customerId: string;
  let productId: string;

  beforeAll(async () => {
    const org = await createOrganization('RBAC LTDA');
    admin = org.admin;
    manager = (await createMember(admin, 'MANAGER')).agent;
    operator = (await createMember(admin, 'OPERATOR')).agent;
    customerId = (await createCustomer(admin)).id;
    productId = (await createProduct(admin)).id;
  });

  it('expõe as permissões do usuário em /auth/me', async () => {
    const me = (await operator.get('/auth/me').expect(200)).body.data;
    expect(me.role).toBe('OPERATOR');
    expect(me.permissions).toContain('orders:write');
    expect(me.permissions).not.toContain('finance:read');
  });

  it('operador: atende clientes e pedidos, sem exclusões, financeiro, relatórios ou usuários', async () => {
    await operator.get('/dashboard').expect(200);
    await operator.post('/customers').send({ type: 'INDIVIDUAL', name: 'Novo' }).expect(201);
    await operator.delete(`/customers/${customerId}`).expect(403);
    await operator.get('/products').expect(200);
    await operator.post('/products').send({ type: 'PRODUCT', name: 'X', sku: 'OP-1', category: 'G', priceCents: 1 }).expect(403);
    await operator.delete(`/products/${productId}`).expect(403);
    await operator.get('/finance/entries').expect(403);
    await operator.get('/finance/summary').expect(403);
    await operator.get('/reports/sales?from=2026-01-01&to=2026-01-31').expect(403);
    await operator.get('/users').expect(403);

    const order = await createOrder(operator, customerId, [{ productId, quantity: 1 }]);
    await setStatus(operator, order.id, 'AWAITING_PAYMENT').expect(200);
    const cancel = await setStatus(operator, order.id, 'CANCELED').expect(403);
    expect(cancel.body.error.code).toBe('FORBIDDEN');
  });

  it('operador não recebe dados financeiros no dashboard', async () => {
    const dash = (await operator.get('/dashboard').expect(200)).body.data;
    expect(dash.finance).toBeNull();
    const dashManager = (await manager.get('/dashboard').expect(200)).body.data;
    expect(dashManager.finance).not.toBeNull();
  });

  it('gerente: comercial e financeiro completos, sem gestão de usuários', async () => {
    await manager.get('/finance/entries').expect(200);
    await manager
      .post('/finance/entries')
      .send({ type: 'EXPENSE', description: 'Internet', category: 'Fixas', amountCents: 9_990, dueDate: '2026-02-01' })
      .expect(201);
    await manager.get('/reports/sales?from=2026-01-01&to=2026-01-31').expect(200);
    await manager.delete(`/customers/${(await createCustomer(manager)).id}`).expect(204);
    await manager.get('/users').expect(403);
    await manager.post('/users').send({ name: 'Hacker', email: uniqueEmail(), role: 'ADMIN', password: PASSWORD }).expect(403);
  });

  it('administrador gerencia usuários com regras de segurança', async () => {
    // Organização própria: este cenário altera a função do administrador.
    const org = await createOrganization('Gestão de usuários');
    const admin = org.admin;
    const adminId = org.adminUser.id;
    await createMember(admin, 'MANAGER');
    await createMember(admin, 'OPERATOR');
    const list = (await admin.get('/users').expect(200)).body.data;
    expect(list.length).toBe(3);
    expect(list[0]).not.toHaveProperty('passwordHash');

    const selfDemote = await admin.patch(`/users/${adminId}`).send({ role: 'OPERATOR' }).expect(422);
    expect(selfDemote.body.error.code).toBe('SELF_CHANGE');
    await admin.patch(`/users/${adminId}`).send({ active: false }).expect(422);

    const second = await createMember(admin, 'ADMIN');
    await second.agent.patch(`/users/${adminId}`).send({ role: 'MANAGER' }).expect(200);
    const last = await admin.patch(`/users/${second.user.id}`).send({ role: 'OPERATOR' }).expect(403); // admin agora é gerente
    expect(last.body.error.code).toBe('FORBIDDEN');
    // segundo admin é o último administrador: outro admin não pode ser rebaixado sem restar ao menos um
    const third = await createMember(second.agent, 'MANAGER');
    await second.agent.patch(`/users/${third.user.id}`).send({ role: 'ADMIN' }).expect(200);
    await third.agent.patch(`/users/${second.user.id}`).send({ role: 'OPERATOR' }).expect(200);
    const blocked = await third.agent.patch(`/users/${third.user.id}`).send({ active: false }).expect(422);
    expect(blocked.body.error.code).toBe('SELF_CHANGE');
  });

  it('impede remover o último administrador ativo', async () => {
    const { admin: soloAdmin } = await createOrganization('Solo');
    const other = await createMember(soloAdmin, 'ADMIN');
    // rebaixa o outro admin → resta 1
    await soloAdmin.patch(`/users/${other.user.id}`).send({ role: 'MANAGER' }).expect(200);
    // promove de volta e tenta rebaixar os dois: o segundo rebaixamento é bloqueado
    await soloAdmin.patch(`/users/${other.user.id}`).send({ role: 'ADMIN' }).expect(200);
    await soloAdmin.patch(`/users/${other.user.id}`).send({ active: false }).expect(200);
    const users = (await soloAdmin.get('/users').expect(200)).body.data as { id: string; role: string; active: boolean }[];
    expect(users.filter((u) => u.role === 'ADMIN' && u.active)).toHaveLength(1);
  });

  it('a função é verificada a cada requisição (mudança tem efeito imediato)', async () => {
    const member = await createMember(admin, 'MANAGER');
    await member.agent.get('/finance/entries').expect(200);
    await admin.patch(`/users/${member.user.id}`).send({ role: 'OPERATOR' }).expect(200);
    await member.agent.get('/finance/entries').expect(403);
  });

  it('redefinição de senha pelo administrador encerra as sessões do usuário', async () => {
    const member = await createMember(admin, 'OPERATOR');
    await admin.post(`/users/${member.user.id}/password`).send({ password: 'Redefinida1' }).expect(204);
    await member.agent.get('/auth/me').expect(401);
  });
});
