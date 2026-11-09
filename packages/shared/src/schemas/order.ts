import { z } from 'zod';
import { ORDER_STATUSES } from '../enums';
import { idSchema, isoDate, moneyCents, optionalText, paginationQuery } from './common';

export const orderItemSchema = z.object({
  productId: idSchema,
  quantity: z.number().int('Quantidade deve ser inteira.').min(1, 'Quantidade mínima: 1.').max(100_000),
  discountCents: moneyCents.default(0),
});

export const orderSchema = z.object({
  customerId: idSchema,
  items: z
    .array(orderItemSchema)
    .min(1, 'Adicione ao menos um item.')
    .max(100, 'Máximo de 100 itens por pedido.')
    .refine(
      (items) => new Set(items.map((i) => i.productId)).size === items.length,
      'Cada produto deve aparecer apenas uma vez no pedido.',
    ),
  discountCents: moneyCents.default(0),
  notes: optionalText(2000),
});
export type OrderInput = z.input<typeof orderSchema>;
export type OrderData = z.output<typeof orderSchema>;

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, { error: 'Status inválido.' }),
  note: optionalText(500),
});
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

export const orderListQuery = paginationQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  customerId: idSchema.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type OrderListQuery = z.infer<typeof orderListQuery>;
