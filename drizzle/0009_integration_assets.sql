CREATE TABLE IF NOT EXISTS `integration_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`object_key` text NOT NULL UNIQUE,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`source_url` text,
	`created_at` integer NOT NULL,
	`approved_at` integer,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_integration_assets_campaign` ON `integration_assets` (`campaign_id`);
