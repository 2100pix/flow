PRAGMA defer_foreign_keys=ON;
--> statement-breakpoint

CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
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
	CONSTRAINT "projects_visibility_check" CHECK("__new_projects"."visibility" in ('workspace', 'private')),
	CONSTRAINT "projects_status_check" CHECK("__new_projects"."status" in ('planning', 'active', 'on_hold', 'completed'))
);
--> statement-breakpoint

INSERT INTO `__new_projects`(
	"id",
	"workspace_id",
	"client_id",
	"name",
	"description",
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
	"name",
	"description",
	'workspace',
	"status",
	"start_date",
	"due_date",
	"discord_channel_url",
	"created_at",
	"updated_at",
	"archived_at"
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

PRAGMA defer_foreign_keys=OFF;