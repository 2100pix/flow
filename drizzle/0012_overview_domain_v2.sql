CREATE TABLE `project_leads` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `user_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_leads_position_check" CHECK("project_leads"."position" >= 0 and "project_leads"."position" <= 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_leads_project_position_unique` ON `project_leads` (`project_id`,`position`);--> statement-breakpoint
CREATE INDEX `project_leads_user_id_idx` ON `project_leads` (`user_id`);--> statement-breakpoint
CREATE TABLE `project_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`url` text,
	`content` text,
	`position` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "project_resources_type_check" CHECK("project_resources"."type" in ('document_brief', 'link')),
	CONSTRAINT "project_resources_position_check" CHECK("project_resources"."position" >= 0),
	CONSTRAINT "project_resources_payload_check" CHECK((
        ("project_resources"."type" = 'link' and "project_resources"."url" is not null and "project_resources"."content" is null)
        or
        ("project_resources"."type" = 'document_brief' and "project_resources"."url" is null)
      ))
);
--> statement-breakpoint
CREATE INDEX `project_resources_project_id_idx` ON `project_resources` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_resources_project_position_unique` ON `project_resources` (`project_id`,`position`);--> statement-breakpoint
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
	`due_date_mode` text DEFAULT 'unset' NOT NULL,
	`discord_channel_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`lead_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "projects_engagement_type_check" CHECK("__new_projects"."engagement_type" in ('project', 'retainer')),
	CONSTRAINT "projects_due_date_mode_check" CHECK("__new_projects"."due_date_mode" in ('unset', 'date', 'ongoing')),
	CONSTRAINT "projects_visibility_check" CHECK("__new_projects"."visibility" in ('workspace', 'private')),
	CONSTRAINT "projects_status_check" CHECK("__new_projects"."status" in ('planning', 'active', 'on_hold', 'completed'))
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "workspace_id", "client_id", "lead_user_id", "name", "project_code_override", "description", "engagement_type", "visibility", "status", "start_date", "due_date", "due_date_mode", "discord_channel_url", "created_at", "updated_at", "archived_at") SELECT "id", "workspace_id", "client_id", "lead_user_id", "name", "project_code_override", "description", "engagement_type", "visibility", "status", "start_date", "due_date", CASE
  WHEN "due_date" IS NOT NULL THEN 'date'
  WHEN "engagement_type" = 'retainer' THEN 'ongoing'
  ELSE 'unset'
END, "discord_channel_url", "created_at", "updated_at", "archived_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `projects_workspace_id_idx` ON `projects` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `projects_client_id_idx` ON `projects` (`client_id`);--> statement-breakpoint
CREATE INDEX `projects_lead_user_id_idx` ON `projects` (`lead_user_id`);

--> statement-breakpoint
INSERT INTO `project_leads` (
  `project_id`,
  `user_id`,
  `position`,
  `created_at`
)
SELECT
  p.`id`,
  p.`lead_user_id`,
  0,
  p.`updated_at`
FROM `projects` p
INNER JOIN `project_members` pm
  ON pm.`project_id` = p.`id`
  AND pm.`user_id` = p.`lead_user_id`
WHERE p.`lead_user_id` IS NOT NULL;