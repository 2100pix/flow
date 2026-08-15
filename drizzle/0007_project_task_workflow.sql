CREATE TABLE `project_task_statuses` (
	`project_id` text NOT NULL,
	`status_key` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`enabled` integer NOT NULL,
	PRIMARY KEY(`project_id`, `status_key`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "project_task_statuses_status_key_check" CHECK("project_task_statuses"."status_key" in ('backlog', 'todo', 'in_progress', 'review', 'done')),
	CONSTRAINT "project_task_statuses_position_check" CHECK("project_task_statuses"."position" >= 0),
	CONSTRAINT "project_task_statuses_enabled_check" CHECK("project_task_statuses"."enabled" in (0, 1))
);

INSERT INTO `project_task_statuses` (
  `project_id`,
  `status_key`,
  `label`,
  `position`,
  `enabled`
)
SELECT
  `id`,
  'backlog',
  'Backlog',
  0,
  1
FROM `projects`;
--> statement-breakpoint

INSERT INTO `project_task_statuses` (
  `project_id`,
  `status_key`,
  `label`,
  `position`,
  `enabled`
)
SELECT
  `id`,
  'todo',
  'To do',
  1,
  1
FROM `projects`;
--> statement-breakpoint

INSERT INTO `project_task_statuses` (
  `project_id`,
  `status_key`,
  `label`,
  `position`,
  `enabled`
)
SELECT
  `id`,
  'in_progress',
  'In progress',
  2,
  1
FROM `projects`;
--> statement-breakpoint

INSERT INTO `project_task_statuses` (
  `project_id`,
  `status_key`,
  `label`,
  `position`,
  `enabled`
)
SELECT
  `id`,
  'review',
  'Review',
  3,
  1
FROM `projects`;
--> statement-breakpoint

INSERT INTO `project_task_statuses` (
  `project_id`,
  `status_key`,
  `label`,
  `position`,
  `enabled`
)
SELECT
  `id`,
  'done',
  'Done',
  4,
  1
FROM `projects`;
--> statement-breakpoint
CREATE UNIQUE INDEX `project_task_statuses_project_position_unique` ON `project_task_statuses` (`project_id`,`position`);