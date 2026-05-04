import { env } from './config/env';
import { logger } from './logger';
import { sequelize } from './models';
import { runSlaTick } from './workers/slaTick';
import { runReminderTick } from './workers/reminderTick';
import { runRecurringTaskTick } from './workers/recurringTaskTick';

const INTERVAL_MS = 60_000;

async function main(): Promise<void> {
  await sequelize.authenticate();
  logger.info('Background worker started', { env: env.nodeEnv });
  setInterval(() => {
    void runSlaTick().catch((err: unknown) => logger.error('SLA worker tick error', { err }));
    void runReminderTick().catch((err: unknown) => logger.error('Reminder tick error', { err }));
    void runRecurringTaskTick().catch((err: unknown) => logger.error('Recurring task tick error', { err }));
  }, INTERVAL_MS);
  await runSlaTick();
  await runReminderTick();
  await runRecurringTaskTick();
}

main().catch((err: unknown) => {
  logger.error('Worker fatal', { err });
  process.exit(1);
});
