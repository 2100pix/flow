CREATE TABLE `discord_interaction_receipts` (
	`interaction_id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`task_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`command_name` text NOT NULL,
	`response_content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "discord_interaction_receipts_command_name_check" CHECK("discord_interaction_receipts"."command_name" in (
        'setstatus',
        'setpriority',
        'setlead',
        'setassign',
        'setstartdate',
        'setduedate'
      ))
);
--> statement-breakpoint
CREATE INDEX `discord_interaction_receipts_workspace_id_idx` ON `discord_interaction_receipts` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `discord_interaction_receipts_task_id_idx` ON `discord_interaction_receipts` (`task_id`);--> statement-breakpoint
CREATE INDEX `discord_interaction_receipts_actor_user_id_idx` ON `discord_interaction_receipts` (`actor_user_id`);