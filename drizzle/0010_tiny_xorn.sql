CREATE TABLE `workspace_access_request_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_access_request_sessions_workspace_user_unique` ON `workspace_access_request_sessions` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `workspace_access_request_sessions_expires_at_idx` ON `workspace_access_request_sessions` (`expires_at`);