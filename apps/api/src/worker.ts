import { env } from './config/env';
import { logger } from './logger';
import { sequelize } from './models';
import { runSlaTick } from './workers/slaTick';
import { runReminderTick } from './workers/reminderTick';
import { runRecurringTaskTick } from './workers/recurringTaskTick';
import { runImportJobsTick } from './workers/importJobsTick';

const INTERVAL_MS = 60_000;
const IMPORT_INTERVAL_MS = 5_000;

async function main(): Promise<void> {
  await sequelize.authenticate();
  logger.info('Background worker started', { env: env.nodeEnv });
  setInterval(() => {
    void runSlaTick().catch((err: unknown) => logger.error('SLA worker tick error', { err }));
    void runReminderTick().catch((err: unknown) => logger.error('Reminder tick error', { err }));
    void runRecurringTaskTick().catch((err: unknown) => logger.error('Recurring task tick error', { err }));
  }, INTERVAL_MS);
  /** Faster cadence for import jobs so wizard polls feel snappy. */
  setInterval(() => {
    void runImportJobsTick().catch((err: unknown) => logger.error('Import jobs tick error', { err }));
  }, IMPORT_INTERVAL_MS);
  await runSlaTick();
  await runReminderTick();
  await runRecurringTaskTick();
  await runImportJobsTick();
}

main().catch((err: unknown) => {
  logger.error('Worker fatal', { err });
  process.exit(1);
});
