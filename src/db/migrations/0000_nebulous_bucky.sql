CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text DEFAULT 'MYR' NOT NULL,
	`opened_at` text NOT NULL,
	`closed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_name_uq` ON `accounts` (`name`);--> statement-breakpoint
CREATE TABLE `allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_month_id` text NOT NULL,
	`envelope_id` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`budget_month_id`) REFERENCES `budget_months`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `allocations_bm_env_idx` ON `allocations` (`budget_month_id`,`envelope_id`);--> statement-breakpoint
CREATE TABLE `budget_months` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`currency` text DEFAULT 'MYR' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `budget_months_month_uq` ON `budget_months` (`month`);--> statement-breakpoint
CREATE TABLE `envelope_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`budget_month_id` text NOT NULL,
	`from_envelope_id` text NOT NULL,
	`to_envelope_id` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`budget_month_id`) REFERENCES `budget_months`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moves_bm_idx` ON `envelope_moves` (`budget_month_id`);--> statement-breakpoint
CREATE TABLE `envelopes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`group_name` text DEFAULT 'General' NOT NULL,
	`is_hidden` integer DEFAULT false NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `envelopes_name_uq` ON `envelopes` (`name`);--> statement-breakpoint
CREATE INDEX `envelopes_group_idx` ON `envelopes` (`group_name`);--> statement-breakpoint
CREATE TABLE `payees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payees_name_uq` ON `payees` (`name`);--> statement-breakpoint
CREATE TABLE `transaction_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`envelope_id` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `splits_tx_idx` ON `transaction_splits` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `splits_env_idx` ON `transaction_splits` (`envelope_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`account_id` text NOT NULL,
	`posted_at` text NOT NULL,
	`amount` integer NOT NULL,
	`payee_name` text,
	`memo` text,
	`cleared` text DEFAULT 'cleared' NOT NULL,
	`skip_budget` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_external_id_uq` ON `transactions` (`external_id`);--> statement-breakpoint
CREATE INDEX `transactions_account_posted_idx` ON `transactions` (`account_id`,`posted_at`);