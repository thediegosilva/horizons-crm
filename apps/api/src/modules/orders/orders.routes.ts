import { orderListQuery, orderSchema, orderStatusSchema } from '@horizons/shared';
import { Router } from 'express';
import { getAuth, idParam, parse } from '../../lib/http';
import { requirePermission } from '../../middlewares/auth';
import * as service from './orders.service';

export const ordersRouter = Router();

ordersRouter.get('/', requirePermission('orders:read'), async (req, res) => {
  res.json(await service.list(getAuth(req), parse(orderListQuery, req.query)));
});

ordersRouter.get('/:id', requirePermission('orders:read'), async (req, res) => {
  res.json({ data: await service.get(getAuth(req), idParam(req, 'Pedido')) });
});

ordersRouter.post('/', requirePermission('orders:write'), async (req, res) => {
  res.status(201).json({ data: await service.create(getAuth(req), parse(orderSchema, req.body)) });
});

ordersRouter.put('/:id', requirePermission('orders:write'), async (req, res) => {
  const id = idParam(req, 'Pedido');
  res.json({ data: await service.update(getAuth(req), id, parse(orderSchema, req.body)) });
});

ordersRouter.patch('/:id/status', requirePermission('orders:status'), async (req, res) => {
  const id = idParam(req, 'Pedido');
  res.json({ data: await service.changeStatus(getAuth(req), id, parse(orderStatusSchema, req.body)) });
});

ordersRouter.delete('/:id', requirePermission('orders:write'), async (req, res) => {
  await service.remove(getAuth(req), idParam(req, 'Pedido'));
  res.status(204).end();
});
