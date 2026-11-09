import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { app, createMember, createOrganization, PASSWORD, uniqueEmail } from '../helpers';

describe('Autenticação', () => {
  it('cadastra empresa + administrador e inicia sessão com cookie httpOnly', async () => {
    const agent = request.agent(app);
    const email = uniqueEmail();
    const res = await agent
      .post('/auth/register')
      .send({ organizationName: 'Loja Aurora', name: 'Maria Lima', email, password: PASSWORD })
      .expect(201);

    expect(res.body.data).toMatchObject({ email, role: 'ADMIN', organization: { name: 'Loja Aurora', isDemo: false } });
    expect(res.body.data.permissions).toContain('users:manage');
    expect(res.body.data).not.toHaveProperty('passwordHash');
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/hz_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await agent.get('/auth/me').expect(200);
    expect(me.body.data.email).toBe(email);
  });

  it('armazena a senha com argon2id e a sessão apenas como hash', async () => {
    const { email } = await createOrganization();
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { sessions: true } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.sessions[0]!.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejeita e-mail duplicado e senha fraca', async () => {
    const { email } = await createOrganization();
    await request(app)
      .post('/auth/register')
      .send({ organizationName: 'Outra Empresa', name: 'Outra', email, password: PASSWORD })
      .expect(409);
    const weak = await request(app)
      .post('/auth/register')
      .send({ organizationName: 'Outra Empresa', name: 'Outra', email: uniqueEmail(), password: '123' })
      .expect(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    expect(weak.body.error.details.fieldErrors.password).toBeDefined();
  });

  it('login com credenciais inválidas retorna mensagem genérica', async () => {
    const { email } = await createOrganization();
    const wrongPass = await request(app).post('/auth/login').send({ email, password: 'Errada123' }).expect(401);
    const noUser = await request(app).post('/auth/login').send({ email: uniqueEmail(), password: 'Errada123' }).expect(401);
    expect(wrongPass.body.error.message).toBe('E-mail ou senha inválidos.');
    expect(noUser.body.error.message).toBe(wrongPass.body.error.message);
  });

  it('login válido, e-mail sem diferenciar maiúsculas', async () => {
    const { email } = await createOrganization();
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: email.toUpperCase(), password: PASSWORD }).expect(200);
    await agent.get('/auth/me').expect(200);
  });

  it('bloqueia rotas protegidas sem sessão ou com token inválido', async () => {
    await request(app).get('/auth/me').expect(401);
    await request(app).get('/customers').expect(401);
    await request(app).get('/customers').set('Cookie', 'hz_session=token-forjado-com-tamanho-suficiente').expect(401);
  });

  it('logout revoga a sessão no servidor', async () => {
    const { admin } = await createOrganization();
    await admin.post('/auth/logout').expect(204);
    await admin.get('/auth/me').expect(401);
  });

  it('alterar a senha exige a senha atual e encerra as outras sessões', async () => {
    const { admin, email } = await createOrganization();
    const other = request.agent(app);
    await other.post('/auth/login').send({ email, password: PASSWORD }).expect(200);

    await admin.post('/auth/password').send({ currentPassword: 'Errada123', newPassword: 'NovaSenha1' }).expect(400);
    await admin.post('/auth/password').send({ currentPassword: PASSWORD, newPassword: 'NovaSenha1' }).expect(204);

    await admin.get('/auth/me').expect(200); // sessão atual continua
    await other.get('/auth/me').expect(401); // outras sessões revogadas
    await request(app).post('/auth/login').send({ email, password: 'NovaSenha1' }).expect(200);
  });

  it('usuário desativado perde a sessão e não consegue entrar', async () => {
    const { admin } = await createOrganization();
    const { agent, user, email } = await createMember(admin, 'OPERATOR');
    await admin.patch(`/users/${user.id}`).send({ active: false }).expect(200);
    await agent.get('/auth/me').expect(401);
    const res = await request(app).post('/auth/login').send({ email, password: PASSWORD }).expect(403);
    expect(res.body.error.code).toBe('USER_INACTIVE');
  });

  it('rejeita requisições de alteração vindas de origem não permitida (CSRF)', async () => {
    const { admin } = await createOrganization();
    const res = await admin
      .post('/customers')
      .set('Origin', 'https://site-malicioso.example')
      .send({ type: 'INDIVIDUAL', name: 'Ataque' })
      .expect(403);
    expect(res.body.error.message).toMatch(/Origem/);
    await admin.post('/customers').set('Origin', 'http://localhost:3000').send({ type: 'INDIVIDUAL', name: 'Ok' }).expect(201);
  });

  it('aceita requisições da própria origem da API (Swagger UI)', async () => {
    await request(app)
      .post('/auth/login')
      .set('Host', 'api.horizons.local')
      .set('Origin', 'http://api.horizons.local')
      .send({ email: uniqueEmail(), password: 'Errada123' })
      .expect(401); // passou pela verificação de origem; falhou apenas nas credenciais
  });

  it('limita tentativas de login (rate limit)', async () => {
    const limited = createApp({ rateLimit: true });
    let last = 0;
    for (let i = 0; i < 21; i++) {
      const res = await request(limited).post('/auth/login').send({ email: 'x@teste.dev', password: 'Errada123' });
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it('retorna erro amigável para JSON malformado e não expõe detalhes internos', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at .*\.ts/);
  });
});
