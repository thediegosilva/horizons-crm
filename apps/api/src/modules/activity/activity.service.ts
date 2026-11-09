import type { Role } from '@horizons/shared';
import type { Db } from '../../lib/prisma';
import type { AuthContext } from '../../types/express';

export interface ActivityInput {
  action: string;
  entityType: 'customer' | 'product' | 'order' | 'finance' | 'user' | 'auth';
  entityId?: string | null;
  description: string;
}

export function logActivity(db: Db, ctx: Pick<AuthContext, 'organizationId' | 'userId'>, input: ActivityInput) {
  return db.activityLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description,
    },
  });
}

/** Cria uma notificação para cada usuário ativo das funções indicadas (exceto quem executou a ação). */
export async function notifyRoles(
  db: Db,
  ctx: Pick<AuthContext, 'organizationId' | 'userId'>,
  roles: Role[],
  notification: { title: string; message: string; link?: string },
) {
  const users = await db.user.findMany({
    where: { organizationId: ctx.organizationId, role: { in: roles }, active: true, id: { not: ctx.userId } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await db.notification.createMany({
    data: users.map((u) => ({
      organizationId: ctx.organizationId,
      userId: u.id,
      title: notification.title,
      message: notification.message,
      link: notification.link ?? null,
    })),
  });
}
