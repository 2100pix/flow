CREATE TABLE `member_expertise` (
	`user_id` text NOT NULL,
	`expertise_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `expertise_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expertise_id`) REFERENCES `workspace_expertise`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_expertise_user_id_idx` ON `member_expertise` (`user_id`);--> statement-breakpoint
CREATE INDEX `member_expertise_expertise_id_idx` ON `member_expertise` (`expertise_id`);--> statement-breakpoint
CREATE TABLE `workspace_expertise` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_expertise_workspace_id_idx` ON `workspace_expertise` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_expertise_workspace_name_unique` ON `workspace_expertise` (`workspace_id`,`name`);