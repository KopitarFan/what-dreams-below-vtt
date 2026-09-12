CREATE TABLE `account_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_account_sessions_account_id` ON `account_sessions` (`account_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `keeper_account_id` text REFERENCES accounts(id);--> statement-breakpoint
CREATE INDEX `idx_campaigns_keeper_account_id` ON `campaigns` (`keeper_account_id`);--> statement-breakpoint
ALTER TABLE `players` ADD `account_id` text REFERENCES accounts(id);--> statement-breakpoint
CREATE INDEX `idx_players_account_campaign` ON `players` (`account_id`,`campaign_id`);
--> statement-breakpoint
PRAGMA optimize;
