PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_task_discord_threads` (
	`task_id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`forum_channel_id` text NOT NULL,
	`thread_id` text,
	`initial_message_id` text,
	`provisioning_status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`last_attempt_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_discord_threads_provisioning_status_check" CHECK(
          "__new_task_discord_threads"."provisioning_status"
          in (
            'pending',
            'ready',
            'error'
          )
        ),
	CONSTRAINT "task_discord_threads_ready_requires_ids_check" CHECK(
        "__new_task_discord_threads"."provisioning_status" <> 'ready'
        or (
          "__new_task_discord_threads"."forum_channel_id" is not null
          and
          "__new_task_discord_threads"."thread_id" is not null
          and
          "__new_task_discord_threads"."initial_message_id" is not null
        )
      ),
	CONSTRAINT "task_discord_threads_attempt_count_check" CHECK(
          "__new_task_discord_threads"."attempt_count" >= 0
        )
);
--> statement-breakpoint
INSERT INTO `__new_task_discord_threads`("task_id", "guild_id", "forum_channel_id", "thread_id", "initial_message_id", "provisioning_status", "attempt_count", "last_error", "last_attempt_at", "created_at", "updated_at") SELECT "task_id", "guild_id", "forum_channel_id", "thread_id", "initial_message_id", "provisioning_status", "attempt_count", "last_error", "last_attempt_at", "created_at", "updated_at" FROM `task_discord_threads`;--> statement-breakpoint
DROP TABLE `task_discord_threads`;--> statement-breakpoint
ALTER TABLE `__new_task_discord_threads` RENAME TO `task_discord_threads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `task_discord_threads_thread_id_unique` ON `task_discord_threads` (`thread_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_discord_threads_initial_message_id_unique` ON `task_discord_threads` (`initial_message_id`);--> statement-breakpoint
CREATE INDEX `task_discord_threads_guild_id_idx` ON `task_discord_threads` (`guild_id`);--> statement-breakpoint
CREATE INDEX `task_discord_threads_forum_channel_id_idx` ON `task_discord_threads` (`forum_channel_id`);--> statement-breakpoint
CREATE INDEX `task_discord_threads_provisioning_status_idx` ON `task_discord_threads` (`provisioning_status`);