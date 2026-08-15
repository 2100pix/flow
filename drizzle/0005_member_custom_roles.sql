PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`custom_role_id` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_role_id`) REFERENCES `workspace_roles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "workspace_members_role_check" CHECK("__new_workspace_members"."role" in ('owner', 'admin', 'member')),
	CONSTRAINT "workspace_members_custom_role_check" CHECK("__new_workspace_members"."role" = 'member' or "__new_workspace_members"."custom_role_id" is null)
);
--> statement-breakpoint
INSERT INTO `__new_workspace_members`("workspace_id", "user_id", "role", "custom_role_id", "created_at") SELECT "workspace_id", "user_id", "role", NULL, "created_at" FROM `workspace_members`;--> statement-breakpointDROP TABLE `workspace_members`;--> statement-breakpoint
ALTER TABLE `__new_workspace_members` RENAME TO `workspace_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `workspace_members_user_id_idx` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `workspace_members_custom_role_id_idx` ON `workspace_members` (`custom_role_id`);