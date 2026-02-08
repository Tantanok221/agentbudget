CREATE TABLE `payee_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`match` text NOT NULL,
	`pattern` text NOT NULL,
	`target_payee_id` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`target_payee_id`) REFERENCES `payees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payee_rules_match_idx` ON `payee_rules` (`match`);--> statement-breakpoint
CREATE INDEX `payee_rules_pattern_idx` ON `payee_rules` (`pattern`);--> statement-breakpoint
CREATE INDEX `payee_rules_target_idx` ON `payee_rules` (`target_payee_id`);