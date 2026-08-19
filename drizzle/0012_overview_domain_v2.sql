CREATE TABLE `project_leads` (
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `user_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_leads_position_check"
		CHECK(
			"project_leads"."position" >= 0
			and
			"project_leads"."position" <= 2
		)
);
--> statement-breakpoint

CREATE UNIQUE INDEX `project_leads_project_position_unique`
ON `project_leads` (`project_id`, `position`);
--> statement-breakpoint

CREATE INDEX `project_leads_user_id_idx`
ON `project_leads` (`user_id`);
--> statement-breakpoint

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
	CONSTRAINT "project_resources_type_check"
		CHECK(
			"project_resources"."type"
			in ('document_brief', 'link')
		),
	CONSTRAINT "project_resources_position_check"
		CHECK(
			"project_resources"."position" >= 0
		),
	CONSTRAINT "project_resources_payload_check"
		CHECK(
			(
				"project_resources"."type" = 'link'
				and
				"project_resources"."url" is not null
				and
				"project_resources"."content" is null
			)
			or
			(
				"project_resources"."type" = 'document_brief'
				and
				"project_resources"."url" is null
			)
		)
);
--> statement-breakpoint

CREATE INDEX `project_resources_project_id_idx`
ON `project_resources` (`project_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `project_resources_project_position_unique`
ON `project_resources` (`project_id`, `position`);
--> statement-breakpoint

ALTER TABLE `projects`
ADD COLUMN `due_date_mode`
text
DEFAULT 'unset'
NOT NULL
CONSTRAINT "projects_due_date_mode_check"
CHECK (
	`due_date_mode` in ('unset', 'date', 'ongoing')
);
--> statement-breakpoint

UPDATE `projects`
SET `due_date_mode` =
	CASE
		WHEN `due_date` IS NOT NULL
			THEN 'date'
		WHEN `engagement_type` = 'retainer'
			THEN 'ongoing'
		ELSE 'unset'
	END;
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