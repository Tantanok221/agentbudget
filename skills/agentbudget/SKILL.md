---
name: agentbudget
description: Agent-native, YNAB-like zero-based envelope budgeting via the `agentbudget` CLI (no frontend). Use when you need to initialize config (local vs Turso/libSQL remote), create/list accounts and envelopes, add/import/list transactions (with splits), allocate budget or move money between envelopes, and generate month summaries with rollover. Especially useful when an agent should programmatically read/write budgeting data using `--json` outputs.
---

# agentbudget

Use the `agentbudget` CLI as the single interface to the budget database.

## Quick start

### 1) Initialize configuration (choose one)

**Local DB** (recommended default):
```bash
agentbudget init --local
```

**Remote DB** (Turso/libSQL):
```bash
export TURSO_DATABASE_URL="libsql://..."
export TURSO_AUTH_TOKEN="..."
agentbudget init --remote
```

### 2) Create required system envelope
```bash
agentbudget system init
```

## Conventions (important)

- **Money is integer minor units** (e.g. cents). `10000` = 100.00.
- **Transaction sign convention (Option A)**:
  - outflow/spend = **negative** (e.g. `-2350`)
  - inflow/income = **positive** (e.g. `200000`)
- **Inflow must be explicitly assigned to TBB**:
  - use `--envelope "To Be Budgeted"` on the inflow transaction.
- Prefer `--json` for agent usage. JSON format:
  - success: `{ "ok": true, "data": ... }`
  - error: `{ "ok": false, "error": { "message": "...", "code": "..." } }`

## Core commands (agent-friendly)

### Discover reference data
```bash
agentbudget account list --json
agentbudget envelope list --json
```

### Create accounts / envelopes
```bash
agentbudget account create "Maybank" --type checking --json
agentbudget envelope create "Groceries" --group "Living" --json
```

### Add a single transaction
Single envelope:
```bash
agentbudget tx add \
  --account "Maybank" \
  --amount -2350 \
  --date 2026-02-08 \
  --payee "Grab" \
  --memo "Food" \
  --envelope "Groceries" \
  --json
```

Split across envelopes:
```bash
agentbudget tx add \
  --account "Maybank" \
  --amount -12000 \
  --date 2026-02-08 \
  --splits-json '[{"envelope":"Groceries","amount":-8000},{"envelope":"Household","amount":-4000}]' \
  --json
```

### Batch import transactions (JSONL)
One JSON object per line. Each record can include either `envelope` or `splits`.
```bash
agentbudget tx import --from-jsonl ./tx.jsonl --json
agentbudget tx import --from-jsonl ./tx.jsonl --dry-run --json
```

### Query transactions
```bash
agentbudget tx list --from 2026-02-01 --to 2026-02-29 --json
agentbudget tx list --envelope "Groceries" --json
agentbudget tx list --search "Grab" --limit 100 --json
```

### Month summary (includes rollover)
```bash
agentbudget month summary 2026-02 --json
```

If TBB is missing, it should instruct you to run:
```bash
agentbudget system init
```

### Budgeting
Allocate to envelopes (writes an offset allocation to TBB automatically):
```bash
agentbudget budget allocate 2026-02 --from-json allocations.json --json
```

Move budget between envelopes:
```bash
agentbudget budget move 2026-02 --from "Groceries" --to "Fun" --amount 10000 --json
```

## Troubleshooting

- If you see SQLite error like `Unable to open connection ... : 14`, run:
  - `agentbudget init --local` (creates a stable DB path + config)
  - or pass an explicit DB URL: `agentbudget --db "file:/abs/path.db" ...`

