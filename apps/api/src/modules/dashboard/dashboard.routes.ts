import { Router } from 'express';
import { getAuth } from '../../lib/http';
import { requirePermission } from '../../middlewares/auth';
import { getDashboard } from './dashboard.service';

export const dashboardRouter = Router();

dashboardRouter.get('/', requirePermission('dashboard:read'), async (req, res) => {
  res.json({ data: await getDashboard(getAuth(req)) });
});
