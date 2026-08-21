CREATE TABLE `project_task_sequences` (
	`project_id` text PRIMARY KEY NOT NULL,
	`next_number` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_task_sequences_next_number_check" CHECK("project_task_sequences"."next_number" >= 1)
);
INSERT INTO `project_task_sequences` (
        `project_id`,
        `next_number`
)
SELECT
        p.`id`,
        COALESCE(MAX(t.`task_number`), 0) + 1
FROM `projects` p
LEFT JOIN `tasks` t
        ON t.`project_id` = p.`id`
GROUP BY p.`id`;
--> statement-breakpoint
CREATE TABLE `task_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`url` text,
	`content` text,
	`position` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "task_resources_type_check" CHECK("task_resources"."type" in ('document_brief', 'link')),
	CONSTRAINT "task_resources_position_check" CHECK("task_resources"."position" >= 0),
	CONSTRAINT "task_resources_payload_check" CHECK((
        (
          "task_resources"."type" = 'link'
          and "task_resources"."url" is not null
          and "task_resources"."content" is null
        )
        or
        (
          "task_resources"."type" = 'document_brief'
          and "task_resources"."url" is null
        )
      ))
);
--> statement-breakpoint
CREATE INDEX `task_resources_task_id_idx` ON `task_resources` (`task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_resources_task_position_unique` ON `task_resources` (`task_id`,`position`);--> statement-breakpoint
PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `__new_workspace_role_permissions` (
	`role_id` text NOT NULL,
	`permission_key` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission_key`),
	FOREIGN KEY (`role_id`) REFERENCES `workspace_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_role_permissions_permission_key_check" CHECK("__new_workspace_role_permissions"."permission_key" in ('workspace.manage', 'dashboard.view', 'members.view', 'members.manage', 'teams.view', 'teams.manage', 'roles.view', 'roles.manage', 'clients.view', 'clients.create', 'clients.edit', 'clients.archive', 'projects.view', 'projects.create', 'projects.edit', 'projects.archive', 'projects.delete', 'projects.private.create', 'projects.private.manage', 'projects.private.view_all', 'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.archive', 'tasks.delete', 'tasks.assign', 'settings.view', 'settings.manage', 'task_fields.view', 'task_fields.manage', 'task_appearance.view', 'task_appearance.manage'))
);
--> statement-breakpoint
INSERT INTO `__new_workspace_role_permissions`("role_id", "permission_key") SELECT "role_id", "permission_key" FROM `workspace_role_permissions`;--> statement-breakpoint
DROP TABLE `workspace_role_permissions`;--> statement-breakpoint
ALTER TABLE `__new_workspace_role_permissions` RENAME TO `workspace_role_permissions`;--> statement-breakpoint
PRAGMA defer_foreign_keys = OFF;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `lead_user_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `tasks_lead_user_id_idx` ON `tasks` (`lead_user_id`);