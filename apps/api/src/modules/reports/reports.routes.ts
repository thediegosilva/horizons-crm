import { REPORT_TYPES, reportQuery } from '@horizons/shared';
import { Router } from 'express';
import { z } from 'zod';
import { getAuth, parse } from '../../lib/http';
import { requirePermission } from '../../middlewares/auth';
import { exportCsv, runReport } from './reports.service';

export const reportsRouter = Router();
reportsRouter.use(requirePermission('reports:read'));

const typeParam = z.enum(REPORT_TYPES, { error: 'Relatório inexistente.' });

reportsRouter.get('/:type', async (req, res) => {
  const type = parse(typeParam, req.params.type);
  res.json({ data: await runReport(getAuth(req), type, parse(reportQuery, req.query)) });
});

reportsRouter.get('/:type/export', async (req, res) => {
  const type = parse(typeParam, req.params.type);
  const q = parse(reportQuery, req.query);
  const csv = await exportCsv(getAuth(req), type, q);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="horizons-${type}-${q.from}_${q.to}.csv"`);
  res.send(csv);
});
