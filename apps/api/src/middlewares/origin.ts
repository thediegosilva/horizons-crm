import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { forbidden } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defesa contra CSRF em profundidade (além do cookie SameSite=Lax):
 * requisições que alteram estado vindas de navegador precisam ter Origin permitido.
 */
export function verifyOrigin(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  // Requisições da própria origem da API (ex.: Swagger UI em /docs) não são cross-site.
  const sameOrigin = origin === `${req.protocol}://${req.get('host')}`;
  if (origin && !sameOrigin && !env.allowedOrigins.includes(origin)) {
    throw forbidden('Origem da requisição não permitida.');
  }
  next();
}
