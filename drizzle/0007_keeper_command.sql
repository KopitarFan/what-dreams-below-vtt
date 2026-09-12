CREATE TABLE `campaign_runtime` (
  `campaign_id` text PRIMARY KEY NOT NULL,
  `state_json` text DEFAULT '{}' NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`)
);
--> statement-breakpoint
CREATE TABLE `private_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `campaign_id` text NOT NULL,
  `player_id` text NOT NULL,
  `sender` text NOT NULL,
  `message` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`),
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_private_messages_player` ON `private_messages` (`campaign_id`,`player_id`);
