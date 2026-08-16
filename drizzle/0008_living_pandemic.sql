PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workspace_role_permissions` (
	`role_id` text NOT NULL,
	`permission_key` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission_key`),
	FOREIGN KEY (`role_id`) REFERENCES `workspace_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_role_permissions_permission_key_check" CHECK("__new_workspace_role_permissions"."permission_key" in ('workspace.manage', 'dashboard.view', 'members.view', 'members.manage', 'teams.view', 'teams.manage', 'roles.view', 'roles.manage', 'clients.view', 'clients.create', 'clients.edit', 'clients.archive', 'projects.view', 'projects.create', 'projects.edit', 'projects.archive', 'projects.private.create', 'projects.private.manage', 'projects.private.view_all', 'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.archive', 'tasks.assign', 'settings.view', 'settings.manage', 'task_fields.view', 'task_fields.manage', 'task_appearance.view', 'task_appearance.manage'))
);
--> statement-breakpoint
INSERT INTO `__new_workspace_role_permissions`("role_id", "permission_key") SELECT "role_id", "permission_key" FROM `workspace_role_permissions`;--> statement-breakpoint
DROP TABLE `workspace_role_permissions`;--> statement-breakpoint
ALTER TABLE `__new_workspace_role_permissions` RENAME TO `workspace_role_permissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;