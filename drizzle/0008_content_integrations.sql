CREATE TABLE `integration_tokens` (`id` text PRIMARY KEY NOT NULL,`campaign_id` text NOT NULL,`name` text NOT NULL,`prefix` text NOT NULL,`token_hash` text NOT NULL UNIQUE,`scopes` text NOT NULL,`revoked_at` integer,`last_used_at` integer,`created_at` integer NOT NULL,FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_integration_tokens_campaign` ON `integration_tokens` (`campaign_id`);
--> statement-breakpoint
CREATE TABLE `content_imports` (`id` text PRIMARY KEY NOT NULL,`campaign_id` text NOT NULL,`status` text DEFAULT 'pending' NOT NULL,`source` text NOT NULL,`title` text NOT NULL,`package_json` text NOT NULL,`validation_json` text DEFAULT '{}' NOT NULL,`created_at` integer NOT NULL,`approved_at` integer,FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_content_imports_campaign` ON `content_imports` (`campaign_id`);
