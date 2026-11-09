import { z } from 'zod';
import { PRODUCT_TYPES } from '../enums';
import { moneyCents, optionalText, paginationQuery } from './common';

const booleanQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

export const productSchema = z.object({
  type: z.enum(PRODUCT_TYPES, { error: 'Tipo inválido.' }),
  name: z.string().trim().min(2, 'Informe o nome.').max(160, 'Máximo de 160 caracteres.'),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Informe o SKU.')
    .max(40, 'Máximo de 40 caracteres.')
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Use apenas letras, números, ponto, hífen ou sublinhado.'),
  description: optionalText(2000),
  category: z.string().trim().min(2, 'Informe a categoria.').max(60, 'Máximo de 60 caracteres.'),
  priceCents: moneyCents,
  stock: z.number().int('Estoque deve ser inteiro.').min(0, 'Estoque não pode ser negativo.').max(10_000_000).default(0),
  minStock: z.number().int().min(0).max(10_000_000).default(0),
  active: z.boolean().default(true),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;

export const productListQuery = paginationQuery.extend({
  type: z.enum(PRODUCT_TYPES).optional(),
  category: z.string().trim().max(60).optional(),
  active: booleanQuery,
  lowStock: booleanQuery,
  sort: z.enum(['name', 'createdAt', 'priceCents', 'stock']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type ProductListQuery = z.infer<typeof productListQuery>;
