import { z } from 'zod';

/** Texto opcional: string vazia vira `null` (útil para formulários). */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const idSchema = z.uuid('Identificador inválido.');

export const isoDate = z.iso.date('Data inválida (use AAAA-MM-DD).');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const periodQuery = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'A data inicial deve ser anterior à final.',
    path: ['to'],
  });

export const moneyCents = z
  .number({ error: 'Informe um valor.' })
  .int('Valor deve estar em centavos (inteiro).')
  .min(0, 'Valor não pode ser negativo.')
  .max(1_000_000_000, 'Valor acima do limite permitido.');

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
