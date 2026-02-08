CREATE TABLE `scheduled_postings` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduled_id` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`transaction_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`scheduled_id`) REFERENCES `scheduled_transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scheduled_postings_uq` ON `scheduled_postings` (`scheduled_id`,`occurrence_date`);--> statement-breakpoint
CREATE INDEX `scheduled_postings_scheduled_idx` ON `scheduled_postings` (`scheduled_id`);--> statement-breakpoint
CREATE INDEX `scheduled_postings_tx_idx` ON `scheduled_postings` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `scheduled_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`account_id` text NOT NULL,
	`envelope_id` text,
	`amount` integer NOT NULL,
	`payee_id` text,
	`payee_name` text,
	`memo` text,
	`rule_json` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`payee_id`) REFERENCES `payees`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scheduled_transactions_name_idx` ON `scheduled_transactions` (`name`);--> statement-breakpoint
CREATE INDEX `scheduled_transactions_account_idx` ON `scheduled_transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `scheduled_transactions_archived_idx` ON `scheduled_transactions` (`archived`);