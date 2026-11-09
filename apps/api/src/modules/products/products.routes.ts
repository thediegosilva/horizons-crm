import { productListQuery, productSchema } from '@horizons/shared';
import { Router } from 'express';
import { getAuth, idParam, parse } from '../../lib/http';
import { requirePermission } from '../../middlewares/auth';
import * as service from './products.service';

export const productsRouter = Router();

productsRouter.get('/', requirePermission('products:read'), async (req, res) => {
  res.json(await service.list(getAuth(req), parse(productListQuery, req.query)));
});

productsRouter.get('/categories', requirePermission('products:read'), async (req, res) => {
  res.json({ data: await service.categories(getAuth(req)) });
});

productsRouter.get('/:id', requirePermission('products:read'), async (req, res) => {
  res.json({ data: await service.get(getAuth(req), idParam(req, 'Produto')) });
});

productsRouter.post('/', requirePermission('products:write'), async (req, res) => {
  res.status(201).json({ data: await service.create(getAuth(req), parse(productSchema, req.body)) });
});

productsRouter.put('/:id', requirePermission('products:write'), async (req, res) => {
  const id = idParam(req, 'Produto');
  res.json({ data: await service.update(getAuth(req), id, parse(productSchema, req.body)) });
});

productsRouter.delete('/:id', requirePermission('products:delete'), async (req, res) => {
  await service.remove(getAuth(req), idParam(req, 'Produto'));
  res.status(204).end();
});
