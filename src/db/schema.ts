import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Conventions:
// - All money is integer minor units (e.g. cents)
// - All timestamps are ISO strings in UTC (TEXT)

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type', { enum: ['checking', 'savings', 'cash', 'tracking'] }).notNull(),
    currency: text('currency').notNull().default('MYR'),
    openedAt: text('opened_at').notNull(),
    closedAt: text('closed_at'),
  },
  (t) => ({
    nameIdx: uniqueIndex('accounts_name_uq').on(t.name),
  }),
);

export const envelopes = sqliteTable(
  'envelopes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    groupName: text('group_name').notNull().default('General'),
    isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    nameIdx: uniqueIndex('envelopes_name_uq').on(t.name),
    groupIdx: index('envelopes_group_idx').on(t.groupName),
  }),
);

export const payees = sqliteTable(
  'payees',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
  },
  (t) => ({
    nameIdx: uniqueIndex('payees_name_uq').on(t.name),
  }),
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    externalId: text('external_id'),

    accountId: text('account_id').notNull().references(() => accounts.id),
    postedAt: text('posted_at').notNull(),
    amount: integer('amount').notNull(),

    payeeName: text('payee_name'),
    memo: text('memo'),

    cleared: text('cleared', { enum: ['pending', 'cleared', 'reconciled'] })
      .notNull()
      .default('cleared'),

    skipBudget: integer('skip_budget', { mode: 'boolean' }).notNull().default(false),

    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    extIdx: uniqueIndex('transactions_external_id_uq').on(t.externalId),
    accountPostedIdx: index('transactions_account_posted_idx').on(t.accountId, t.postedAt),
  }),
);

export const transactionSplits = sqliteTable(
  'transaction_splits',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
    envelopeId: text('envelope_id').notNull().references(() => envelopes.id),
    amount: integer('amount').notNull(),
    note: text('note'),
  },
  (t) => ({
    txIdx: index('splits_tx_idx').on(t.transactionId),
    envIdx: index('splits_env_idx').on(t.envelopeId),
  }),
);

export const budgetMonths = sqliteTable(
  'budget_months',
  {
    id: text('id').primaryKey(),
    month: text('month').notNull(), // YYYY-MM
    currency: text('currency').notNull().default('MYR'),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    monthIdx: uniqueIndex('budget_months_month_uq').on(t.month),
  }),
);

export const allocations = sqliteTable(
  'allocations',
  {
    id: text('id').primaryKey(),
    budgetMonthId: text('budget_month_id').notNull().references(() => budgetMonths.id, { onDelete: 'cascade' }),
    envelopeId: text('envelope_id').notNull().references(() => envelopes.id),
    amount: integer('amount').notNull(),
    source: text('source', { enum: ['manual', 'rule', 'rollover', 'adjustment'] }).notNull().default('manual'),
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    bmEnvIdx: index('allocations_bm_env_idx').on(t.budgetMonthId, t.envelopeId),
  }),
);

export const envelopeMoves = sqliteTable(
  'envelope_moves',
  {
    id: text('id').primaryKey(),
    budgetMonthId: text('budget_month_id').notNull().references(() => budgetMonths.id, { onDelete: 'cascade' }),
    fromEnvelopeId: text('from_envelope_id').notNull().references(() => envelopes.id),
    toEnvelopeId: text('to_envelope_id').notNull().references(() => envelopes.id),
    amount: integer('amount').notNull(), // positive
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    bmIdx: index('moves_bm_idx').on(t.budgetMonthId),
  }),
);
