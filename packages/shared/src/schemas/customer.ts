import { z } from 'zod';
import { CUSTOMER_TYPES } from '../enums';
import { isValidCnpj, isValidCpf, onlyDigits } from '../documents';
import { optionalText, paginationQuery } from './common';

export const customerSchema = z
  .object({
    type: z.enum(CUSTOMER_TYPES, { error: 'Tipo inválido.' }),
    name: z.string().trim().min(2, 'Informe o nome ou razão social.').max(160, 'Máximo de 160 caracteres.'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(160)
      .nullish()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido.'),
    phone: optionalText(30).refine(
      (v) => v === null || /^[\d\s()+-]{8,30}$/.test(v),
      'Telefone inválido.',
    ),
    document: optionalText(20).transform((v) => (v ? onlyDigits(v) : null)),
    zipCode: optionalText(9).transform((v) => (v ? onlyDigits(v) : null)),
    street: optionalText(160),
    number: optionalText(20),
    complement: optionalText(80),
    district: optionalText(80),
    city: optionalText(80),
    state: optionalText(2)
      .transform((v) => (v ? v.toUpperCase() : null))
      .refine((v) => v === null || /^[A-Z]{2}$/.test(v), 'UF inválida.'),
    notes: optionalText(2000),
  })
  .superRefine((data, ctx) => {
    if (data.document) {
      const valid = data.type === 'INDIVIDUAL' ? isValidCpf(data.document) : isValidCnpj(data.document);
      if (!valid) {
        ctx.addIssue({
          code: 'custom',
          path: ['document'],
          message: data.type === 'INDIVIDUAL' ? 'CPF inválido.' : 'CNPJ inválido.',
        });
      }
    }
    if (data.zipCode && data.zipCode.length !== 8) {
      ctx.addIssue({ code: 'custom', path: ['zipCode'], message: 'CEP deve ter 8 dígitos.' });
    }
  });

export type CustomerInput = z.input<typeof customerSchema>;
export type CustomerData = z.output<typeof customerSchema>;

export const customerListQuery = paginationQuery.extend({
  type: z.enum(CUSTOMER_TYPES).optional(),
  sort: z.enum(['name', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type CustomerListQuery = z.infer<typeof customerListQuery>;
