import type { Request } from 'express';
import { z } from 'zod';
import type { AuthContext } from '../types/express';
import { AppError, unauthorized } from './errors';

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const flat = z.flattenError(result.error);
    const first = result.error.issues[0];
    throw new AppError(400, 'VALIDATION_ERROR', first?.message ?? 'Dados inválidos.', {
      formErrors: flat.formErrors,
      fieldErrors: flat.fieldErrors,
    });
  }
  return result.data;
}

export const uuidParam = z.uuid();

/** Valida o parâmetro :id. Um id malformado é tratado como inexistente (404). */
export function idParam(req: Request, entity = 'Registro'): string {
  const result = uuidParam.safeParse(req.params.id);
  if (!result.success) throw new AppError(404, 'NOT_FOUND', `${entity} não encontrado.`);
  return result.data;
}

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export function pagination(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
