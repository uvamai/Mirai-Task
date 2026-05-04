import { Sequelize } from 'sequelize';
import { env } from './env';
import { logger } from '../logger';

export const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  logging: env.nodeEnv === 'development' ? (msg: string) => logger.debug(msg) : false,
});
