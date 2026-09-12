CREATE TABLE `loot` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'mundane' NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`assigned_player_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_loot_campaign` ON `loot` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `idx_loot_player` ON `loot` (`assigned_player_id`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`chapter` text DEFAULT 'Chapter 1' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`clues` text DEFAULT '' NOT NULL,
	`keeper_notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_scenes_campaign_order` ON `scenes` (`campaign_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `board_pieces` ADD `details_json` text DEFAULT '{}' NOT NULL;