import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '@horizons/shared';
import { Router, type Request, type Response } from 'express';
import { getAuth, parse } from '../../lib/http';
import { authenticate, SESSION_COOKIE, sessionCookieOptions } from '../../middlewares/auth';
import type { RateLimitRequestHandler } from 'express-rate-limit';
import * as service from './auth.service';

function meta(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

function setSessionCookie(res: Response, session: { token: string; ttlMs: number }) {
  res.cookie(SESSION_COOKIE, session.token, sessionCookieOptions(session.ttlMs));
}

export function authRoutes(authLimiter: RateLimitRequestHandler | null) {
  const router = Router();
  const limit = authLimiter ? [authLimiter] : [];

  router.post('/register', ...limit, async (req, res) => {
    const input = parse(registerSchema, req.body);
    const { session, user } = await service.register(input, meta(req));
    setSessionCookie(res, session);
    res.status(201).json({ data: user });
  });

  router.post('/login', ...limit, async (req, res) => {
    const input = parse(loginSchema, req.body);
    const { session, user } = await service.login(input, meta(req));
    setSessionCookie(res, session);
    res.json({ data: user });
  });

  router.post('/logout', authenticate, async (req, res) => {
    await service.logout(getAuth(req).sessionId);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    res.status(204).end();
  });

  router.get('/me', authenticate, async (req, res) => {
    res.json({ data: await service.getCurrentUser(getAuth(req).userId) });
  });

  router.patch('/profile', authenticate, async (req, res) => {
    const input = parse(updateProfileSchema, req.body);
    res.json({ data: await service.updateProfile(getAuth(req), input.name) });
  });

  router.post('/password', authenticate, ...limit, async (req, res) => {
    const input = parse(changePasswordSchema, req.body);
    await service.changePassword(getAuth(req), input);
    res.status(204).end();
  });

  return router;
}
