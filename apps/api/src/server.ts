import http from 'http';
import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './logger';
import { sequelize } from './models';
import { initSocket } from './realtime/socket';
import { purgeActivityLogsOlderThan } from './services/activityRetention';

async function main(): Promise<void> {
  await sequelize.authenticate();
  const app = buildApp();
  const server = http.createServer(app);
  if (env.socketEnabled) {
    initSocket(server);
    logger.info('Socket.IO enabled');
  }
  if (env.activityLogRetentionDays > 0) {
    const dayMs = 24 * 60 * 60 * 1000;
    const run = () => {
      void purgeActivityLogsOlderThan(env.activityLogRetentionDays).catch((err: unknown) =>
        logger.error('activity_logs purge failed', { err })
      );
    };
    setTimeout(run, 120_000);
    setInterval(run, dayMs);
    logger.info('activity_logs retention scheduled', { days: env.activityLogRetentionDays });
  }
  server.listen(env.port, () => {
    logger.info('API listening', { port: env.port, env: env.nodeEnv });
  });
}

main().catch((err: unknown) => {
  logger.error('Fatal startup', { err });
  process.exit(1);
});
