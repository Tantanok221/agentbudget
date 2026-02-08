// Split out schedule schema to keep schema.ts readable.
// Re-exported from schema.ts.

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { accounts, envelopes, payees, transactions } from './schema.js';

export const scheduledTransactions = sqliteTable(
  'scheduled_transactions',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),

    accountId: text('account_id').notNull().references(() => accounts.id),
    envelopeId: text('envelope_id').references(() => envelopes.id),

    amount: integer('amount').notNull(),

    payeeId: text('payee_id').references(() => payees.id),
    payeeName: text('payee_name'),
    memo: text('memo'),

    // JSON string containing: { freq, interval, ... }
    ruleJson: text('rule_json').notNull(),
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
    scheduledId: text('scheduled_id').notNull().references(() => scheduledTransactions.id),
    occurrenceDate: text('occurrence_date').notNull(), // YYYY-MM-DD
    transactionId: text('transaction_id').notNull().references(() => transactions.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    uniqIdx: uniqueIndex('scheduled_postings_uq').on(t.scheduledId, t.occurrenceDate),
    scheduledIdx: index('scheduled_postings_scheduled_idx').on(t.scheduledId),
    txIdx: index('scheduled_postings_tx_idx').on(t.transactionId),
  }),
);
