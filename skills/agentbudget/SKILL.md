---
name: agentbudget
description: Use the `agentbudget` CLI to run an agent-first, YNAB-like zero-based envelope budget: initialize local/remote DB config, bootstrap the required TBB system envelope, create/list accounts and envelopes, add/import/list/update/delete transactions (including splits), allocate and move budget, and generate month summaries with rollover or a high-level overview. Prefer `--json` for programmatic use.
---

# agentbudget

Use `agentbudget` as the **single interface** to the budget database (local SQLite or Turso/libSQL remote).

## Core conventions

- **Money is integer minor units** (e.g. cents). `10000` = 100.00.
- **Transaction sign convention:** outflow = negative, inflow = positive.
- **Inflow must be explicitly assigned to TBB** using `--envelope "To Be Budgeted"`.
- For agent calls, use `--json`.
  - success: `{ "ok": true, "data": ... }`
  - error: `{ "ok": false, "error": { "message": "...", "code"?: "..." } }`

## Workflow (recommended)

### 1) Initialize database config (choose one)

Local:
```bash
agentbudget init --local
```

Remote (Turso):
```bash
export TURSO_DATABASE_URL="libsql://..."
export TURSO_AUTH_TOKEN="..."
agentbudget init --remote
```

### 2) Bootstrap required system entities

Create the required system envelope **To Be Budgeted** (TBB):
```bash
agentbudget system init
```

### 3) Create reference data

Accounts:
```bash
agentbudget account create "Maybank" --type checking --json
agentbudget account list --json
```

Envelopes:
```bash
agentbudget envelope create "Groceries" --group "Living" --json
agentbudget envelope list --json
```

### 4) Ingest transactions

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

Split a transaction across envelopes:
```bash
agentbudget tx add \
  --account "Maybank" \
  --amount -12000 \
  --date 2026-02-08 \
  --splits-json '[{"envelope":"Groceries","amount":-8000},{"envelope":"Household","amount":-4000}]' \
  --json
```

Batch import JSONL (one JSON object per line; each record can use `envelope` or `splits`):
```bash
agentbudget tx import --from-jsonl ./tx.jsonl --json
agentbudget tx import --from-jsonl ./tx.jsonl --dry-run --json
```

Transfer between accounts (does not touch envelopes):
```bash
agentbudget tx transfer \
  --from-account "Checking" \
  --to-account "Savings" \
  --amount 25000 \
  --date 2026-02-05 \
  --memo "move money" \
  --json
```

Query:
```bash
agentbudget tx list --from 2026-02-01 --to 2026-02-29 --json
agentbudget tx list --envelope "Groceries" --json
```

Update (basic patch + optional split replacement):
```bash
agentbudget tx update tx_... --memo "new memo" --json
agentbudget tx update tx_... \
  --splits-json '[{"envelope":"Groceries","amount":-2500,"note":"splitnote"}]' \
  --json
```

Delete (hard delete):
```bash
agentbudget tx delete tx_... --json
```

### 5) Budget actions

Allocate (writes a matching TBB offset allocation automatically):
```bash
agentbudget budget allocate 2026-02 --from-json allocations.json --json
```

Move budget between envelopes:
```bash
agentbudget budget move 2026-02 --from "Groceries" --to "Fun" --amount 10000 --json
```

### 6) Read current state

Month summary (includes rollover):
```bash
agentbudget month summary 2026-02 --json
```

Overview (high-level: account balances, overspent, overbudget):
```bash
agentbudget overview --month 2026-02 --json
```

## Troubleshooting

- SQLite/libSQL error like `Unable to open connection ... : 14` usually means the local DB path is not writable.
  - Fix by running: `agentbudget init --local`
  - Or override: `agentbudget --db "file:/absolute/path.db" ...`
