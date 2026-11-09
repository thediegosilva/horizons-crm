import { ROLE_PERMISSIONS, type ChangePasswordInput, type LoginInput, type RegisterInput } from '@horizons/shared';
import { env } from '../../config/env';
import { AppError, notFound, unauthorized } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { generateSessionToken, getDummyHash, hashPassword, sha256, verifyPassword } from '../../lib/security';
import type { AuthContext } from '../../types/express';
import { logActivity } from '../activity/activity.service';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  lastLoginAt: true,
  organization: { select: { id: true, name: true, isDemo: true } },
} as const;

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) throw notFound('Usuário');
  return { ...user, permissions: ROLE_PERMISSIONS[user.role] };
}

async function createSession(userId: string, meta: SessionMeta) {
  const token = generateSessionToken();
  const ttlMs = env.SESSION_TTL_HOURS * 3_600_000;
  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ttlMs),
      ip: meta.ip?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  });
  // Limpeza oportunista de sessões expiradas do usuário
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  return { token, ttlMs };
}

export async function register(input: RegisterInput, meta: SessionMeta) {
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: input.organizationName } });
    const created = await tx.user.create({
      data: {
        organizationId: organization.id,
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'ADMIN',
        lastLoginAt: new Date(),
      },
    });
    await logActivity(tx, { organizationId: organization.id, userId: created.id }, {
      action: 'organization.created',
      entityType: 'auth',
      description: `Conta da empresa ${organization.name} criada por ${created.name}`,
    });
    return created;
  });
  const session = await createSession(user.id, meta);
  return { session, user: await getCurrentUser(user.id) };
}

export async function login(input: LoginInput, meta: SessionMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Sempre executa a verificação de hash para não revelar, pelo tempo de resposta, se o e-mail existe.
  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), input.password);
  if (!user || !valid) throw unauthorized('E-mail ou senha inválidos.');
  if (!user.active) throw new AppError(403, 'USER_INACTIVE', 'Este usuário está desativado. Procure o administrador.');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const session = await createSession(user.id, meta);
  return { session, user: await getCurrentUser(user.id) };
}

export async function logout(sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function updateProfile(ctx: AuthContext, name: string) {
  await prisma.user.update({ where: { id: ctx.userId }, data: { name } });
  return getCurrentUser(ctx.userId);
}

export async function changePassword(ctx: AuthContext, input: ChangePasswordInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Senha atual incorreta.');
  }
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Encerra todas as outras sessões do usuário
    prisma.session.deleteMany({ where: { userId: user.id, id: { not: ctx.sessionId } } }),
  ]);
}
