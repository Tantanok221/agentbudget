CREATE TABLE `targets` (
	`id` text PRIMARY KEY NOT NULL,
	`envelope_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer,
	`target_amount` integer,
	`target_month` text,
	`start_month` text,
	`note` text,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `targets_envelope_uq` ON `targets` (`envelope_id`);--> statement-breakpoint
CREATE INDEX `targets_type_idx` ON `targets` (`type`);