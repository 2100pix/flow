CREATE TABLE `task_discord_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`due_date` text NOT NULL,
	`kind` text NOT NULL,
	`delivery_status` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_discord_reminders_kind_check" CHECK("task_discord_reminders"."kind" in ('day_before', 'due_today')),
	CONSTRAINT "task_discord_reminders_delivery_status_check" CHECK("task_discord_reminders"."delivery_status" in ('pending', 'sent', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_discord_reminders_task_user_due_kind_unique` ON `task_discord_reminders` (`task_id`,`user_id`,`due_date`,`kind`);--> statement-breakpoint
CREATE INDEX `task_discord_reminders_workspace_id_idx` ON `task_discord_reminders` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `task_discord_reminders_task_id_idx` ON `task_discord_reminders` (`task_id`);--> statement-breakpoint
CREATE INDEX `task_discord_reminders_delivery_status_idx` ON `task_discord_reminders` (`delivery_status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspace_discord_integrations` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`guild_id` text,
	`guild_name` text,
	`project_category_id` text,
	`reminders_enabled` integer DEFAULT false NOT NULL,
	`reminder_time_zone` text DEFAULT 'UTC' NOT NULL,
	`reminder_hour_local` integer DEFAULT 9 NOT NULL,
	`connected_by_user_id` text,
	`connected_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connected_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "workspace_discord_integrations_enabled_requires_guild_check" CHECK(
          "__new_workspace_discord_integrations"."enabled" = 0
          or
          "__new_workspace_discord_integrations"."guild_id" is not null
        ),
	CONSTRAINT "workspace_discord_integrations_reminder_hour_check" CHECK(
    "__new_workspace_discord_integrations"."reminder_hour_local" >= 0
    and
    "__new_workspace_discord_integrations"."reminder_hour_local" <= 23
  ),
	CONSTRAINT "workspace_discord_integrations_category_requires_guild_check" CHECK(
          "__new_workspace_discord_integrations"."project_category_id" is null
          or
          "__new_workspace_discord_integrations"."guild_id" is not null
        )
);
--> statement-breakpoint
INSERT INTO `__new_workspace_discord_integrations`("workspace_id", "enabled", "guild_id", "guild_name", "project_category_id", "reminders_enabled", "reminder_time_zone", "reminder_hour_local", "connected_by_user_id", "connected_at", "created_at", "updated_at") SELECT "workspace_id", "enabled", "guild_id", "guild_name", "project_category_id", "reminders_enabled", "reminder_time_zone", "reminder_hour_local", "connected_by_user_id", "connected_at", "created_at", "updated_at" FROM `workspace_discord_integrations`;--> statement-breakpoint
DROP TABLE `workspace_discord_integrations`;--> statement-breakpoint
ALTER TABLE `__new_workspace_discord_integrations` RENAME TO `workspace_discord_integrations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_discord_integrations_guild_id_unique` ON `workspace_discord_integrations` (`guild_id`);--> statement-breakpoint
CREATE INDEX `workspace_discord_integrations_connected_by_user_id_idx` ON `workspace_discord_integrations` (`connected_by_user_id`);