import { z } from 'zod';
import { isoDate } from './common';

export const REPORT_TYPES = ['sales', 'customers', 'top-products', 'revenue', 'orders-by-status'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const reportQuery = z
  .object({
    from: isoDate,
    to: isoDate,
    groupBy: z.enum(['day', 'month']).default('day'),
  })
  .refine((v) => v.from <= v.to, { message: 'A data inicial deve ser anterior à final.', path: ['to'] })
  .refine(
    (v) => (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 731,
    { message: 'O período máximo é de 2 anos.', path: ['to'] },
  );
export type ReportQuery = z.infer<typeof reportQuery>;
