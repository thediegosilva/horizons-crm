import { financeListQuery, financialEntrySchema, payEntrySchema, periodQuery } from '@horizons/shared';
import { Router } from 'express';
import { env } from '../../config/env';
import { addMonths, endOfMonth, todayInTz } from '../../lib/dates';
import { getAuth, idParam, parse } from '../../lib/http';
import { requirePermission } from '../../middlewares/auth';
import * as service from './finance.service';

export const financeRouter = Router();
const read = requirePermission('finance:read');
const write = requirePermission('finance:write');

financeRouter.get('/entries', read, async (req, res) => {
  res.json(await service.list(getAuth(req), parse(financeListQuery, req.query)));
});

financeRouter.get('/summary', read, async (req, res) => {
  res.json({ data: await service.summary(getAuth(req), parse(periodQuery, req.query)) });
});

financeRouter.get('/cashflow', read, async (req, res) => {
  const q = parse(periodQuery, req.query);
  const today = todayInTz(env.APP_TIMEZONE);
  const from = q.from ?? addMonths(today, -11);
  const to = q.to ?? endOfMonth(today);
  res.json({ data: await service.cashflow(getAuth(req), from, to) });
});

financeRouter.get('/categories', read, async (req, res) => {
  res.json({ data: await service.categories(getAuth(req)) });
});

financeRouter.get('/entries/:id', read, async (req, res) => {
  res.json({ data: await service.get(getAuth(req), idParam(req, 'Lançamento')) });
});

financeRouter.post('/entries', write, async (req, res) => {
  res.status(201).json({ data: await service.create(getAuth(req), parse(financialEntrySchema, req.body)) });
});

financeRouter.put('/entries/:id', write, async (req, res) => {
  const id = idParam(req, 'Lançamento');
  res.json({ data: await service.update(getAuth(req), id, parse(financialEntrySchema, req.body)) });
});

financeRouter.post('/entries/:id/pay', write, async (req, res) => {
  const id = idParam(req, 'Lançamento');
  const { paidAt } = parse(payEntrySchema, req.body ?? {});
  res.json({ data: await service.pay(getAuth(req), id, paidAt) });
});

financeRouter.post('/entries/:id/cancel', write, async (req, res) => {
  res.json({ data: await service.cancel(getAuth(req), idParam(req, 'Lançamento')) });
});

financeRouter.delete('/entries/:id', write, async (req, res) => {
  await service.remove(getAuth(req), idParam(req, 'Lançamento'));
  res.status(204).end();
});
