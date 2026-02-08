ALTER TABLE `payees` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `payees` ADD `updated_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `payee_id` text REFERENCES payees(id);