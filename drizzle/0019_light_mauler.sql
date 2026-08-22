CREATE TABLE `project_discord_forums` (
	`project_id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`forum_channel_id` text,
	`provisioning_status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_attempt_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_discord_forums_status_check" CHECK(
          "project_discord_forums"."provisioning_status"
          in (
            'pending',
            'ready',
            'error'
          )
        ),
	CONSTRAINT "project_discord_forums_ready_channel_check" CHECK(
          "project_discord_forums"."provisioning_status" != 'ready'
          or
          "project_discord_forums"."forum_channel_id" is not null
        ),
	CONSTRAINT "project_discord_forums_attempt_count_check" CHECK(
          "project_discord_forums"."attempt_count" >= 0
        )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_discord_forums_forum_channel_id_unique` ON `project_discord_forums` (`forum_channel_id`);--> statement-breakpoint
CREATE INDEX `project_discord_forums_guild_id_idx` ON `project_discord_forums` (`guild_id`);--> statement-breakpoint
CREATE INDEX `project_discord_forums_provisioning_status_idx` ON `project_discord_forums` (`provisioning_status`);