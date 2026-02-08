import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    // Used by drizzle-kit for push/introspection. For Turso/libSQL, we still target sqlite dialect.
    url: process.env.TURSO_DATABASE_URL ?? 'file:./data/local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
