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
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    nameIdx: uniqueIndex('payees_name_uq').on(t.name),
  }),
);

export const payeeRules = sqliteTable(
  'payee_rules',
  {
    id: text('id').primaryKey(),
    match: text('match', { enum: ['exact', 'contains', 'regex'] }).notNull(),
    pattern: text('pattern').notNull(),
    targetPayeeId: text('target_payee_id')
      .notNull()
      .references(() => payees.id, { onDelete: 'cascade' }),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    matchIdx: index('payee_rules_match_idx').on(t.match),
    patternIdx: index('payee_rules_pattern_idx').on(t.pattern),
    targetIdx: index('payee_rules_target_idx').on(t.targetPayeeId),
  }),
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    externalId: text('external_id'),

    // Transfers: two linked transactions share the same transferGroupId.
    // transferPeerId points to the other side.
    transferGroupId: text('transfer_group_id'),
    transferPeerId: text('transfer_peer_id'),

    accountId: text('account_id').notNull().references(() => accounts.id),
    postedAt: text('posted_at').notNull(),
    amount: integer('amount').notNull(),

    payeeId: text('payee_id').references(() => payees.id),
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
    transferGroupIdx: index('transactions_transfer_group_idx').on(t.transferGroupId),
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

export const targets = sqliteTable(
  'targets',
  {
    id: text('id').primaryKey(),
    envelopeId: text('envelope_id').notNull().references(() => envelopes.id, { onDelete: 'cascade' }),

    type: text('type', { enum: ['monthly', 'needed_for_spending', 'by_date'] }).notNull(),

    // monthly + needed_for_spending
    amount: integer('amount'),

    // by_date
    targetAmount: integer('target_amount'),
    targetMonth: text('target_month'), // YYYY-MM
    startMonth: text('start_month'), // YYYY-MM

    note: text('note'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    envIdx: uniqueIndex('targets_envelope_uq').on(t.envelopeId),
    typeIdx: index('targets_type_idx').on(t.type),
  }),
);

export const scheduledTransactions = sqliteTable(
  'scheduled_transactions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),

    accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

    // v1: single-envelope schedules
    envelopeId: text('envelope_id').references(() => envelopes.id, { onDelete: 'set null' }),

    amount: integer('amount').notNull(),

    payeeId: text('payee_id').references(() => payees.id, { onDelete: 'set null' }),
    payeeName: text('payee_name'),
    memo: text('memo'),

    // JSON string containing: { freq, interval, ... }
    ruleJson: text('rule_json').notNull(),

    // Date-only semantics
    startDate: text('start_date').notNull(), // YYYY-MM-DD
    endDate: text('end_date'),

    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    nameIdx: index('scheduled_transactions_name_idx').on(t.name),
    accountIdx: index('scheduled_transactions_account_idx').on(t.accountId),
    archivedIdx: index('scheduled_transactions_archived_idx').on(t.archived),
  }),
);

export const scheduledPostings = sqliteTable(
  'scheduled_postings',
  {
    id: text('id').primaryKey(),
    scheduledId: text('scheduled_id').notNull().references(() => scheduledTransactions.id, { onDelete: 'cascade' }),
    occurrenceDate: text('occurrence_date').notNull(), // YYYY-MM-DD
    transactionId: text('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    uniqIdx: uniqueIndex('scheduled_postings_uq').on(t.scheduledId, t.occurrenceDate),
    scheduledIdx: index('scheduled_postings_scheduled_idx').on(t.scheduledId),
    txIdx: index('scheduled_postings_tx_idx').on(t.transactionId),
  }),
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
