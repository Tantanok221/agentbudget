# agentbudget

Agent-first, YNAB-like zero-based envelope budgeting CLI.

- TypeScript + Node CLI
- Turso/libSQL backend + Drizzle ORM migrations
- **Agent-first output:** most commands support `--json` and return `{ ok, data }` / `{ ok, error }`

## Install (via clone)

### Prereqs
- Node.js 20+ recommended
- npm

### 1) Clone + install

```bash
git clone https://github.com/Tantanok221/agentbudget.git
cd agentbudget
npm install
```

### 2) Build

```bash
npm run build
```

### 3) Run the CLI

Run from the repo:
```bash
node dist/cli.js --help
```

Or use the dev runner:
```bash
npm run dev -- --help
```

Optional: link globally during development:
```bash
npm link
agentbudget --help
```

## Initialize a database

`agentbudget` can use either:
- local SQLite/libSQL file DB (`file:/...`)
- Turso remote DB (`libsql://...`)

### Local (recommended to start)

```bash
agentbudget init --local
agentbudget system init
```

### Turso (remote)

```bash
export TURSO_DATABASE_URL="libsql://..."
export TURSO_AUTH_TOKEN="..."

agentbudget init --remote
agentbudget system init
```

Config is written to:
- `~/.config/agentbudget/config.json`

You can override per-command:
```bash
agentbudget --db "file:/absolute/path.db" overview --month 2026-02
```

## Quickstart

Create accounts/envelopes:
```bash
agentbudget account create "Bank" --type checking --json
agentbudget envelope create "Food" --group "Living" --json
```

Add a transaction (**major-unit inputs**, stored as minor units internally):
```bash
agentbudget tx add \
  --account "Bank" \
  --amount -23.50 \
  --date 2026-02-08 \
  --payee "Grab" \
  --envelope "Food" \
  --json
```

See an overview:
```bash
agentbudget overview --month 2026-02
agentbudget overview --month 2026-02 --json
```

## Development notes

### Migrations
Migrations live in `src/db/migrations`.

### Tests
```bash
npm test
```

## Environment variables

- `TURSO_DATABASE_URL` (e.g. `libsql://...` or `file:./data/local.db`)
- `TURSO_AUTH_TOKEN` (if using Turso)

### Testing helpers
- `AGENTBUDGET_TODAY=YYYY-MM-DD` overrides "today" for schedule/overview tests.
