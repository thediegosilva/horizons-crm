import { ROLE_LABELS, type CreateUserInput, type UpdateUserInput } from '@horizons/shared';
import { notFound, unprocessable } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/security';
import type { AuthContext } from '../../types/express';
import { logActivity } from '../activity/activity.service';

type Ctx = Pick<AuthContext, 'organizationId' | 'userId'>;

/** Nunca retorna o hash da senha. */
const publicUser = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

async function findOwned(ctx: Ctx, id: string) {
  const user = await prisma.user.findFirst({ where: { id, organizationId: ctx.organizationId }, select: publicUser });
  if (!user) throw notFound('Usuário');
  return user;
}

export function list(ctx: Ctx) {
  return prisma.user.findMany({
    where: { organizationId: ctx.organizationId },
    select: publicUser,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
}

export async function create(ctx: Ctx, input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { organizationId: ctx.organizationId, name: input.name, email: input.email, role: input.role, passwordHash },
      select: publicUser,
    });
    await logActivity(tx, ctx, {
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      description: `Usuário ${user.name} adicionado como ${ROLE_LABELS[user.role]}`,
    });
    return user;
  });
}

export async function update(ctx: Ctx, id: string, input: UpdateUserInput) {
  const current = await findOwned(ctx, id);
  const isSelf = id === ctx.userId;
  if (isSelf && input.role && input.role !== current.role) {
    throw unprocessable('Você não pode alterar a sua própria função.', 'SELF_CHANGE');
  }
  if (isSelf && input.active === false) {
    throw unprocessable('Você não pode desativar o seu próprio usuário.', 'SELF_CHANGE');
  }

  return prisma.$transaction(async (tx) => {
    const removingAdmin =
      current.role === 'ADMIN' && current.active && ((input.role && input.role !== 'ADMIN') || input.active === false);
    if (removingAdmin) {
      const admins = await tx.user.count({ where: { organizationId: ctx.organizationId, role: 'ADMIN', active: true } });
      if (admins <= 1) throw unprocessable('A organização precisa ter ao menos um administrador ativo.', 'LAST_ADMIN');
    }
    const user = await tx.user.update({ where: { id }, data: input, select: publicUser });
    if (input.active === false) {
      await tx.session.deleteMany({ where: { userId: id } });
    }
    await logActivity(tx, ctx, {
      action: 'user.updated',
      entityType: 'user',
      entityId: id,
      description: `Usuário ${user.name} atualizado${input.active === false ? ' (desativado)' : ''}`,
    });
    return user;
  });
}

export async function resetPassword(ctx: Ctx, id: string, password: string) {
  const user = await findOwned(ctx, id);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ]);
  await logActivity(prisma, ctx, {
    action: 'user.password_reset',
    entityType: 'user',
    entityId: id,
    description: `Senha do usuário ${user.name} redefinida`,
  });
}
