CREATE TABLE `workspace_discord_integrations` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`guild_id` text,
	`guild_name` text,
	`project_category_id` text,
	`connected_by_user_id` text,
	`connected_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connected_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "workspace_discord_integrations_enabled_requires_guild_check" CHECK(
          "workspace_discord_integrations"."enabled" = 0
          or
          "workspace_discord_integrations"."guild_id" is not null
        ),
	CONSTRAINT "workspace_discord_integrations_category_requires_guild_check" CHECK(
          "workspace_discord_integrations"."project_category_id" is null
          or
          "workspace_discord_integrations"."guild_id" is not null
        )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_discord_integrations_guild_id_unique` ON `workspace_discord_integrations` (`guild_id`);--> statement-breakpoint
CREATE INDEX `workspace_discord_integrations_connected_by_user_id_idx` ON `workspace_discord_integrations` (`connected_by_user_id`);