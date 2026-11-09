import { createUserSchema, passwordSchema, updateUserSchema } from '@horizons/shared';
import { Router } from 'express';
import { z } from 'zod';
import { getAuth, idParam, parse } from '../../lib/http';
import { requirePermission } from '../../middlewares/auth';
import * as service from './users.service';

export const usersRouter = Router();
usersRouter.use(requirePermission('users:manage'));

usersRouter.get('/', async (req, res) => {
  res.json({ data: await service.list(getAuth(req)) });
});

usersRouter.post('/', async (req, res) => {
  res.status(201).json({ data: await service.create(getAuth(req), parse(createUserSchema, req.body)) });
});

usersRouter.patch('/:id', async (req, res) => {
  const id = idParam(req, 'Usuário');
  res.json({ data: await service.update(getAuth(req), id, parse(updateUserSchema, req.body)) });
});

usersRouter.post('/:id/password', async (req, res) => {
  const id = idParam(req, 'Usuário');
  const { password } = parse(z.object({ password: passwordSchema }), req.body);
  await service.resetPassword(getAuth(req), id, password);
  res.status(204).end();
});
