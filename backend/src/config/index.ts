import { config } from 'dotenv';
config();

export const env = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/loni',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
