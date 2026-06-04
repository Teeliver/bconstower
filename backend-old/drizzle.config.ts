import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: '14.225.231.70',
    user: 'bconstow_saoviet',
    password: 'Betee92@',
    database: 'bconstow_saoviet',
  },
});