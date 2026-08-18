PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_id` text NOT NULL,
	`lead_user_id` text,
	`name` text NOT NULL,
	`project_code_override` text,
	`description` text,
	`engagement_type` text DEFAULT 'project' NOT NULL,
	`visibility` text DEFAULT 'workspace' NOT NULL,
	`status` text NOT NULL,
	`start_date` text,
	`due_date` text,
	`discord_channel_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lead_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "projects_engagement_type_check" CHECK("__new_projects"."engagement_type" in ('project', 'retainer')),
	CONSTRAINT "projects_visibility_check" CHECK("__new_projects"."visibility" in ('workspace', 'private')),
	CONSTRAINT "projects_status_check" CHECK("__new_projects"."status" in ('planning', 'active', 'on_hold', 'completed'))
);
--> statement-breakpoint
INSERT INTO `__new_projects`(
  "id",
  "workspace_id",
  "client_id",
  "lead_user_id",
  "name",
  "project_code_override",
  "description",
  "engagement_type",
  "visibility",
  "status",
  "start_date",
  "due_date",
  "discord_channel_url",
  "created_at",
  "updated_at",
  "archived_at"
)
SELECT
  "id",
  "workspace_id",
  "client_id",
  NULL,
  "name",
  NULL,
  "description",
  'project',
  "visibility",
  "status",
  "start_date",
  "due_date",
  "discord_channel_url",
  "created_at",
  "updated_at",
  "archived_at"
FROM `projects`;
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `projects_workspace_id_idx` ON `projects` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `projects_client_id_idx` ON `projects` (`client_id`);--> statement-breakpoint
CREATE INDEX `projects_lead_user_id_idx` ON `projects` (`lead_user_id`);