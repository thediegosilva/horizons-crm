import { hasPermission, type Permission } from '@horizons/shared';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { sha256 } from '../lib/security';

export const SESSION_COOKIE = 'hz_session';
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function sessionCookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

/** Exige sessão válida. Popula `req.auth` com usuário, organização e função. */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) {
    throw unauthorized();
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, organizationId: true, role: true, active: true, name: true, email: true } } },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.active) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    throw unauthorized('Sessão expirada. Entre novamente.');
  }

  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  }

  req.auth = {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
    sessionId: session.id,
    name: session.user.name,
    email: session.user.email,
  };
  next();
}

/** Autorização no servidor: bloqueia a rota se a função do usuário não tiver a permissão. */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw unauthorized();
    const role = req.auth.role;
    if (!permissions.every((p) => hasPermission(role, p))) throw forbidden();
    next();
  };
}
