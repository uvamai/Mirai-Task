import { drainImportJobs } from '../services/excelImportService';
import { logger } from '../logger';

export async function runImportJobsTick(): Promise<number> {
  try {
    const n = await drainImportJobs({ maxJobs: 5, leaseMs: 120_000 });
    if (n > 0) logger.info('import jobs drained', { jobs: n });
    return n;
  } catch (err) {
    logger.error('import jobs tick error', { err });
    return 0;
  }
}
