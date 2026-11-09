import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { Prisma } from '../generated/prisma/client';

const UNIQUE_MESSAGES: Record<string, string> = {
  email: 'Este e-mail já está em uso.',
  sku: 'Já existe um produto com este SKU.',
  document: 'Já existe um cliente com este CPF/CNPJ.',
};

function uniqueMessage(err: Prisma.PrismaClientKnownRequestError) {
  const meta = JSON.stringify(err.meta ?? {});
  for (const [field, message] of Object.entries(UNIQUE_MESSAGES)) {
    if (meta.includes(field)) return message;
  }
  return 'Registro duplicado.';
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'CONFLICT', message: uniqueMessage(err) } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'O registro está vinculado a outros dados e não pode ser removido.' },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registro não encontrado.' } });
      return;
    }
  }

  // JSON malformado ou corpo grande demais (body-parser)
  const status = (err as { status?: number; type?: string })?.status;
  if (status && status >= 400 && status < 500) {
    const message =
      (err as { type?: string }).type === 'entity.too.large' ? 'Corpo da requisição muito grande.' : 'Requisição inválida.';
    res.status(status).json({ error: { code: 'BAD_REQUEST', message } });
    return;
  }

  // Erros inesperados: registra no servidor e nunca expõe detalhes internos ao cliente.
  if (env.NODE_ENV !== 'test') console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente mais tarde.' } });
}
