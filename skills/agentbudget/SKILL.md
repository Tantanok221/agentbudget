---
name: agentbudget
description: Step-by-step instructions for using the `agentbudget` CLI in an agent-first, YNAB-like envelope budgeting workflow: initialize local/remote DB config, bootstrap system entities (TBB), create/list accounts and envelopes, add/import/list/update/delete transactions (with splits), allocate and move budget, view month summaries (with rollover), and get a high-level `overview` status using `--json` outputs.
---

# agentbudget

Treat this as an operating manual for `agentbudget`.

## 0) Conventions (important)

- **Money is integer minor units** (e.g. cents). `10000` = 100.00.
- **Transaction sign convention (Option A):**
  - outflow/spend = **negative** (e.g. `-2350`)
  - inflow/income = **positive** (e.g. `200000`)
- **Inflow must be explicitly assigned to TBB:**
  - use `--envelope "To Be Budgeted"` on inflow transactions.
- Prefer `--json` for agent usage. JSON format:
  - success: `{ "ok": true, "data": ... }`
  - error: `{ "ok": false, "error": { "message": "...", "code": "..." } }`

## 1) Initialize the database (choose one)

### Local DB (recommended default)
```bash
agentbudget init --local
```

### Remote DB (Turso/libSQL)
```bash
export TURSO_DATABASE_URL="libsql://..."
export TURSO_AUTH_TOKEN="..."
agentbudget init --remote
```

## 2) Bootstrap system entities

Create the required **To Be Budgeted** (TBB) system envelope:
```bash
agentbudget system init
```

## 3) Setup reference data

### Accounts
```bash
agentbudget account create "Maybank" --type checking --json
agentbudget account list --json
```

### Envelopes
```bash
agentbudget envelope create "Groceries" --group "Living" --json
agentbudget envelope list --json
```

## 4) Transactions

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

### Batch import (JSONL)
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

### Update a transaction (basic)
- You can patch fields like `--memo`, `--payee`, `--amount`, `--date`, etc.
- You can replace splits with `--envelope` or `--splits-json`.

```bash
agentbudget tx update tx_... --memo "new memo" --json

agentbudget tx update tx_... \
  --splits-json '[{"envelope":"Groceries","amount":-2500,"note":"splitnote"}]' \
  --json
```

### Delete a transaction (hard delete)
```bash
agentbudget tx delete tx_... --json
```

## 5) Budgeting

### Allocate to envelopes
This writes an offset allocation to TBB automatically.
```bash
agentbudget budget allocate 2026-02 --from-json allocations.json --json
```

### Move budget between envelopes
```bash
agentbudget budget move 2026-02 --from "Groceries" --to "Fun" --amount 10000 --json
```

## 6) Month summary (includes rollover)
```bash
agentbudget month summary 2026-02 --json
```

If TBB is missing, run:
```bash
agentbudget system init
```

## 7) Overview (high-level status)
Shows:
- account balances
- whether you are **overbudget** (TBB available < 0)
- whether any envelopes are **overspent** (available < 0)

```bash
agentbudget overview --month 2026-02 --json
```

## Troubleshooting

- If you see SQLite error like `Unable to open connection ... : 14`, run:
  - `agentbudget init --local` (creates a stable DB path + config)
  - or pass an explicit DB URL: `agentbudget --db "file:/abs/path.db" ...`
