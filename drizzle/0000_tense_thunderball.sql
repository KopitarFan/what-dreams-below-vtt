CREATE TABLE `board_pieces` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`initials` text NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`hp` integer,
	`max_hp` integer,
	`hidden` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`join_code` text NOT NULL,
	`keeper_token` text NOT NULL,
	`year` text DEFAULT '1926' NOT NULL,
	`location` text DEFAULT 'Los Angeles County' NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`session_number` integer DEFAULT 0 NOT NULL,
	`scene_title` text DEFAULT 'An empty table' NOT NULL,
	`scene_description` text DEFAULT 'The Keeper has not set the first scene.' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_join_code_unique` ON `campaigns` (`join_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_keeper_token_unique` ON `campaigns` (`keeper_token`);--> statement-breakpoint
CREATE TABLE `game_events` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`actor` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`payload_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`player_token` text NOT NULL,
	`character_json` text,
	`x` integer DEFAULT 45 NOT NULL,
	`y` integer DEFAULT 55 NOT NULL,
	`on_board` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_player_token_unique` ON `players` (`player_token`);