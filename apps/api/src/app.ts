import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './logger';
import { requestIdMiddleware } from './middleware/requestId';
import { healthRouter } from './routes/health';
import { publicRouter } from './routes/public';
import { authRouter } from './routes/auth';
import { projectsRouter } from './routes/projects';
import { projectScopedRouter } from './routes/projectScopedRoutes';
import { tenantSettingsRouter } from './routes/tenantSettings';
import { authSsoRouter } from './routes/authSso';
import { billingRouter } from './routes/billing';
import { employeesRouter } from './routes/employees';
import { tasksRouter } from './routes/tasks';
import { agentsAdminRouter, agentsApiRouter } from './routes/agents';
import { adminRouter } from './routes/admin';
import { stripeWebhooksRouter } from './routes/webhooks';
import { invitationsAdminRouter, invitationsPublicRouter } from './routes/invitations';
import { notificationsRouter } from './routes/notifications';
import { intakePublicRouter } from './routes/intakePublic';
import { contactSalesRouter } from './routes/contactSales';
import { globalAdminRouter } from './routes/globalAdmin';
import { swaggerSpec } from './swagger';
import { integrationsRouter } from './routes/integrations';
import { dashboardRouter } from './routes/dashboard';

export function buildApp(): express.Express {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(
    morgan('combined', {
      stream: { write: (message: string) => logger.info(message.trim()) },
    })
  );

  app.use(
    '/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '1mb' }),
    stripeWebhooksRouter
  );
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  app.use(invitationsPublicRouter);
  app.use(intakePublicRouter);
  app.use(contactSalesRouter);
  app.use(publicRouter);
  app.use(authRouter);
  app.use(authSsoRouter);
  app.use(projectScopedRouter);
  app.use(tenantSettingsRouter);
  app.use(projectsRouter);
  app.use(dashboardRouter);
  app.use(employeesRouter);
  app.use(invitationsAdminRouter);
  app.use(notificationsRouter);
  app.use(tasksRouter);
  app.use(agentsAdminRouter);
  app.use(agentsApiRouter);
  app.use(integrationsRouter);
  app.use(billingRouter);
  app.use(adminRouter);
  app.use(globalAdminRouter);

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
