import { customerListQuery, customerSchema } from '@horizons/shared';
import { Router } from 'express';
import { getAuth, idParam, parse } from '../../lib/http';
import { requirePermission } from '../../middlewares/auth';
import * as service from './customers.service';

export const customersRouter = Router();

customersRouter.get('/', requirePermission('customers:read'), async (req, res) => {
  res.json(await service.list(getAuth(req), parse(customerListQuery, req.query)));
});

customersRouter.get('/:id', requirePermission('customers:read'), async (req, res) => {
  res.json({ data: await service.get(getAuth(req), idParam(req, 'Cliente')) });
});

customersRouter.post('/', requirePermission('customers:write'), async (req, res) => {
  res.status(201).json({ data: await service.create(getAuth(req), parse(customerSchema, req.body)) });
});

customersRouter.put('/:id', requirePermission('customers:write'), async (req, res) => {
  const id = idParam(req, 'Cliente');
  res.json({ data: await service.update(getAuth(req), id, parse(customerSchema, req.body)) });
});

customersRouter.delete('/:id', requirePermission('customers:delete'), async (req, res) => {
  await service.remove(getAuth(req), idParam(req, 'Cliente'));
  res.status(204).end();
});
