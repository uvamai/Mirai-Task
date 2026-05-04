import winston from 'winston';

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: jsonFormat,
  defaultMeta: { service: 'mirai-api' },
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});
