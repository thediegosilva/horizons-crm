import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './docs/openapi';
import { prisma } from './lib/prisma';
import { authenticate } from './middlewares/auth';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { verifyOrigin } from './middlewares/origin';
import { authRoutes } from './modules/auth/auth.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { financeRouter } from './modules/finance/finance.routes';
import { activitiesRouter, notificationsRouter } from './modules/notifications/notifications.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { productsRouter } from './modules/products/products.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { usersRouter } from './modules/users/users.routes';

export interface AppOptions {
  /** Limite de tentativas em login/cadastro. Desativado apenas em testes. */
  rateLimit?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  // A API roda atrás do proxy do Next.js / Docker: confia apenas em proxies da rede local.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');

  const openapi = buildOpenApiDocument();
  // Documentação: CSP relaxada apenas para os assets do Swagger UI.
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  // Redirecionamento relativo: funciona tanto em /docs quanto atrás do proxy (/api/docs).
  app.get('/docs', (req, res, next) => (req.path.endsWith('/') ? next() : res.redirect(301, 'docs/')));
  app.use('/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(openapi, {
    customSiteTitle: 'Horizons CRM — API',
  }));

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(verifyOrigin);

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  const authLimiter =
    options.rateLimit === false
      ? null
      : rateLimit({
          windowMs: 15 * 60 * 1000,
          limit: 20,
          standardHeaders: 'draft-8',
          legacyHeaders: false,
          handler: (_req, res) => {
            res.status(429).json({
              error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
            });
          },
        });

  app.use('/auth', authRoutes(authLimiter));

  // Todas as rotas abaixo exigem sessão válida.
  const api = Router();
  api.use(authenticate);
  api.use('/dashboard', dashboardRouter);
  api.use('/activities', activitiesRouter);
  api.use('/customers', customersRouter);
  api.use('/products', productsRouter);
  api.use('/orders', ordersRouter);
  api.use('/finance', financeRouter);
  api.use('/reports', reportsRouter);
  api.use('/users', usersRouter);
  api.use('/notifications', notificationsRouter);
  app.use(api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
