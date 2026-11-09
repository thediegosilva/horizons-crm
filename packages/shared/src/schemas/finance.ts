import { z } from 'zod';
import { FINANCIAL_STATUSES, FINANCIAL_TYPES } from '../enums';
import { isoDate, moneyCents, optionalText, paginationQuery } from './common';

export const financialEntrySchema = z
  .object({
    type: z.enum(FINANCIAL_TYPES, { error: 'Tipo inválido.' }),
    description: z.string().trim().min(2, 'Informe a descrição.').max(160),
    category: z.string().trim().min(2, 'Informe a categoria.').max(60),
    amountCents: moneyCents.refine((v) => v > 0, 'O valor deve ser maior que zero.'),
    dueDate: isoDate,
    status: z.enum(['PENDING', 'PAID']).default('PENDING'),
    paidAt: isoDate.nullish(),
    notes: optionalText(1000),
  })
  .transform((v) => ({ ...v, paidAt: v.status === 'PAID' ? (v.paidAt ?? v.dueDate) : null }));
export type FinancialEntryInput = z.input<typeof financialEntrySchema>;
export type FinancialEntryData = z.output<typeof financialEntrySchema>;

export const payEntrySchema = z.object({ paidAt: isoDate.optional() });

export const financeListQuery = paginationQuery.extend({
  type: z.enum(FINANCIAL_TYPES).optional(),
  status: z.enum(FINANCIAL_STATUSES).optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type FinanceListQuery = z.infer<typeof financeListQuery>;
