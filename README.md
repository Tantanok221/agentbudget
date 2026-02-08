# envelope-agent (temporary name)

Agent-first, zero-based envelope budgeting CLI (YNAB-like) backed by Turso (libSQL) via Drizzle ORM.

## Dev

```bash
npm i
npm run dev -- ping
```

## Env

- `TURSO_DATABASE_URL` (e.g. `libsql://...` or `file:./data/local.db`)
- `TURSO_AUTH_TOKEN` (if using Turso)

