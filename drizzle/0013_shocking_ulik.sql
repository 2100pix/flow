PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint

CREATE TABLE `__new_workspace_role_permissions` (
	`role_id` text NOT NULL,
	`permission_key` text NOT NULL,
	PRIMARY KEY(`role_id`, `permission_key`),
	FOREIGN KEY (`role_id`) REFERENCES `workspace_roles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_role_permissions_permission_key_check"
	CHECK(
		"__new_workspace_role_permissions"."permission_key" in (
			'workspace.manage',
			'dashboard.view',
			'members.view',
			'members.manage',
			'teams.view',
			'teams.manage',
			'roles.view',
			'roles.manage',
			'clients.view',
			'clients.create',
			'clients.edit',
			'clients.archive',
			'projects.view',
			'projects.create',
			'projects.edit',
			'projects.archive',
			'projects.delete',
			'projects.private.create',
			'projects.private.manage',
			'projects.private.view_all',
			'tasks.view',
			'tasks.create',
			'tasks.edit',
			'tasks.archive',
			'tasks.assign',
			'settings.view',
			'settings.manage',
			'task_fields.view',
			'task_fields.manage',
			'task_appearance.view',
			'task_appearance.manage'
		)
	)
);
--> statement-breakpoint

INSERT INTO `__new_workspace_role_permissions` (
	`role_id`,
	`permission_key`
)
SELECT
	`role_id`,
	`permission_key`
FROM `workspace_role_permissions`;
--> statement-breakpoint

DROP TABLE `workspace_role_permissions`;
--> statement-breakpoint

ALTER TABLE `__new_workspace_role_permissions`
RENAME TO `workspace_role_permissions`;
--> statement-breakpoint

CREATE TABLE `__backup_project_members` AS
SELECT
	`project_id`,
	`user_id`,
	`created_at`
FROM `project_members`;
--> statement-breakpoint

CREATE TABLE `__backup_project_leads` AS
SELECT
	`project_id`,
	`user_id`,
	`position`,
	`created_at`
FROM `project_leads`;
--> statement-breakpoint

CREATE TABLE `__backup_project_resources` AS
SELECT
	`id`,
	`project_id`,
	`type`,
	`title`,
	`url`,
	`content`,
	`position`,
	`created_by`,
	`created_at`,
	`updated_at`
FROM `project_resources`;
--> statement-breakpoint

CREATE TABLE `__backup_project_task_statuses` AS
SELECT
	`project_id`,
	`status_key`,
	`label`,
	`position`,
	`enabled`
FROM `project_task_statuses`;
--> statement-breakpoint

CREATE TABLE `__backup_tasks` AS
SELECT
	`id`,
	`project_id`,
	`title`,
	`description`,
	`status`,
	`priority`,
	`assignee_id`,
	`due_date`,
	`sort_order`,
	`discord_thread_url`,
	`created_by`,
	`created_at`,
	`updated_at`,
	`archived_at`
FROM `tasks`;
--> statement-breakpoint

CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_id` text,
	`lead_user_id` text,
	`name` text NOT NULL,
	`project_code_override` text,
	`description` text,
	`engagement_type` text DEFAULT 'project' NOT NULL,
	`visibility` text DEFAULT 'workspace' NOT NULL,
	`status` text NOT NULL,
	`start_date` text,
	`due_date` text,
	`due_date_mode` text DEFAULT 'unset' NOT NULL,
	`discord_channel_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lead_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "projects_engagement_type_check"
	CHECK(
		"__new_projects"."engagement_type" in ('project', 'retainer')
	),
	CONSTRAINT "projects_due_date_mode_check"
	CHECK(
		"__new_projects"."due_date_mode" in ('unset', 'date', 'ongoing')
	),
	CONSTRAINT "projects_visibility_check"
	CHECK(
		"__new_projects"."visibility" in ('workspace', 'private')
	),
	CONSTRAINT "projects_status_check"
	CHECK(
		"__new_projects"."status" in (
			'planning',
			'active',
			'on_hold',
			'completed'
		)
	)
);
--> statement-breakpoint

INSERT INTO `__new_projects` (
	`id`,
	`workspace_id`,
	`client_id`,
	`lead_user_id`,
	`name`,
	`project_code_override`,
	`description`,
	`engagement_type`,
	`visibility`,
	`status`,
	`start_date`,
	`due_date`,
	`due_date_mode`,
	`discord_channel_url`,
	`created_at`,
	`updated_at`,
	`archived_at`
)
SELECT
	`id`,
	`workspace_id`,
	`client_id`,
	`lead_user_id`,
	`name`,
	`project_code_override`,
	`description`,
	`engagement_type`,
	`visibility`,
	`status`,
	`start_date`,
	`due_date`,
	`due_date_mode`,
	`discord_channel_url`,
	`created_at`,
	`updated_at`,
	`archived_at`
FROM `projects`;
--> statement-breakpoint

DROP TABLE `projects`;
--> statement-breakpoint

ALTER TABLE `__new_projects`
RENAME TO `projects`;
--> statement-breakpoint

CREATE INDEX `projects_workspace_id_idx`
ON `projects` (`workspace_id`);
--> statement-breakpoint

CREATE INDEX `projects_client_id_idx`
ON `projects` (`client_id`);
--> statement-breakpoint

CREATE INDEX `projects_lead_user_id_idx`
ON `projects` (`lead_user_id`);
--> statement-breakpoint

INSERT INTO `project_members` (
	`project_id`,
	`user_id`,
	`created_at`
)
SELECT
	`project_id`,
	`user_id`,
	`created_at`
FROM `__backup_project_members`;
--> statement-breakpoint

INSERT INTO `project_leads` (
	`project_id`,
	`user_id`,
	`position`,
	`created_at`
)
SELECT
	`project_id`,
	`user_id`,
	`position`,
	`created_at`
FROM `__backup_project_leads`;
--> statement-breakpoint

INSERT INTO `project_resources` (
	`id`,
	`project_id`,
	`type`,
	`title`,
	`url`,
	`content`,
	`position`,
	`created_by`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`project_id`,
	`type`,
	`title`,
	`url`,
	`content`,
	`position`,
	`created_by`,
	`created_at`,
	`updated_at`
FROM `__backup_project_resources`;
--> statement-breakpoint

INSERT INTO `project_task_statuses` (
	`project_id`,
	`status_key`,
	`label`,
	`position`,
	`enabled`
)
SELECT
	`project_id`,
	`status_key`,
	`label`,
	`position`,
	`enabled`
FROM `__backup_project_task_statuses`;
--> statement-breakpoint

INSERT INTO `tasks` (
	`id`,
	`project_id`,
	`title`,
	`description`,
	`status`,
	`priority`,
	`assignee_id`,
	`due_date`,
	`sort_order`,
	`discord_thread_url`,
	`created_by`,
	`created_at`,
	`updated_at`,
	`archived_at`
)
SELECT
	`id`,
	`project_id`,
	`title`,
	`description`,
	`status`,
	`priority`,
	`assignee_id`,
	`due_date`,
	`sort_order`,
	`discord_thread_url`,
	`created_by`,
	`created_at`,
	`updated_at`,
	`archived_at`
FROM `__backup_tasks`;
--> statement-breakpoint

DROP TABLE `__backup_project_members`;
--> statement-breakpoint

DROP TABLE `__backup_project_leads`;
--> statement-breakpoint

DROP TABLE `__backup_project_resources`;
--> statement-breakpoint

DROP TABLE `__backup_project_task_statuses`;
--> statement-breakpoint

DROP TABLE `__backup_tasks`;
--> statement-breakpoint

PRAGMA defer_foreign_keys = OFF;