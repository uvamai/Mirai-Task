/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '..', '.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const shared = {
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: {
    ...shared,
    url: process.env.DATABASE_URL,
  },
  test: {
    ...shared,
    url: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL,
  },
  production: {
    ...shared,
    url: process.env.DATABASE_URL,
    dialectOptions: process.env.DATABASE_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  },
};
