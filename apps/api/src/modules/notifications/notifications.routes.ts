import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { getAuth, idParam, pageMeta, pagination, parse } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { requirePermission } from '../../middlewares/auth';

export const notificationsRouter = Router();

notificationsRouter.get('/', async (req, res) => {
  const { userId } = getAuth(req);
  const [data, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  res.json({ data, meta: { unread } });
});

notificationsRouter.post('/read-all', async (req, res) => {
  const { userId } = getAuth(req);
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const { userId } = getAuth(req);
  const id = idParam(req, 'Notificação');
  // Filtra pelo dono → um usuário não consegue alterar notificações de outro.
  const result = await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  if (result.count === 0) throw notFound('Notificação');
  res.status(204).end();
});

export const activitiesRouter = Router();

activitiesRouter.get('/', requirePermission('dashboard:read'), async (req, res) => {
  const { organizationId } = getAuth(req);
  const q = parse(
    z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20) }),
    req.query,
  );
  const [total, data] = await prisma.$transaction([
    prisma.activityLog.count({ where: { organizationId } }),
    prisma.activityLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      ...pagination(q.page, q.pageSize),
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);
  res.json({ data, meta: pageMeta(q.page, q.pageSize, total) });
});
