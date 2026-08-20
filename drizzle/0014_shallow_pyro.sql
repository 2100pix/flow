PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint

CREATE TABLE `__new_project_task_statuses` (
  `project_id` text NOT NULL,
  `status_key` text NOT NULL,
  `label` text NOT NULL,
  `position` integer NOT NULL,
  `enabled` integer NOT NULL,

  PRIMARY KEY(`project_id`, `status_key`),

  FOREIGN KEY (`project_id`)
    REFERENCES `projects`(`id`)
    ON UPDATE no action
    ON DELETE cascade,

  CONSTRAINT "project_task_statuses_status_key_check"
    CHECK(
      `status_key` in (
        'backlog',
        'todo',
        'in_progress',
        'review',
        'done',
        'cancelled'
      )
    ),

  CONSTRAINT "project_task_statuses_position_check"
    CHECK(`position` >= 0),

  CONSTRAINT "project_task_statuses_enabled_check"
    CHECK(`enabled` in (0, 1))
);
--> statement-breakpoint

INSERT INTO `__new_project_task_statuses` (
  `project_id`,
  `status_key`,
  `label`,
  `position`,
  `enabled`
)
SELECT
  `project_id`,
  `status_key`,

  CASE
    WHEN `status_key` = 'todo'
      AND `label` = 'To do'
      THEN 'Ready'

    WHEN `status_key` = 'in_progress'
      AND `label` = 'In progress'
      THEN 'Progress'

    WHEN `status_key` = 'review'
      AND `label` = 'Review'
      THEN 'In review'

    WHEN `status_key` = 'done'
      AND `label` = 'Done'
      THEN 'Complete'

    ELSE `label`
  END,

  `position`,
  `enabled`

FROM `project_task_statuses`;
--> statement-breakpoint

DROP TABLE `project_task_statuses`;
--> statement-breakpoint

ALTER TABLE `__new_project_task_statuses`
RENAME TO `project_task_statuses`;
--> statement-breakpoint

CREATE UNIQUE INDEX
  `project_task_statuses_project_position_unique`
ON `project_task_statuses` (
  `project_id`,
  `position`
);
--> statement-breakpoint

INSERT INTO `project_task_statuses` (
  `project_id`,
  `status_key`,
  `label`,
  `position`,
  `enabled`
)
SELECT
  `projects`.`id`,
  'cancelled',
  'Cancelled',

  COALESCE(
    (
      SELECT MAX(`existing`.`position`) + 1
      FROM `project_task_statuses` AS `existing`
      WHERE
        `existing`.`project_id` = `projects`.`id`
    ),
    0
  ),

  1

FROM `projects`;
--> statement-breakpoint

CREATE TABLE `__new_tasks` (
  `id` text PRIMARY KEY NOT NULL,

  `project_id` text NOT NULL,

  `task_number` integer NOT NULL,

  `title` text NOT NULL,

  `description` text,

  `status` text NOT NULL,

  `priority` text,

  `assignee_id` text,

  `start_date` text NOT NULL,

  `due_date` text,

  `sort_order` integer NOT NULL,

  `discord_thread_url` text,

  `created_by` text NOT NULL,

  `created_at` integer NOT NULL,

  `updated_at` integer NOT NULL,

  `archived_at` integer,

  FOREIGN KEY (`project_id`)
    REFERENCES `projects`(`id`)
    ON UPDATE no action
    ON DELETE cascade,

  FOREIGN KEY (`assignee_id`)
    REFERENCES `users`(`id`)
    ON UPDATE no action
    ON DELETE set null,

  FOREIGN KEY (`created_by`)
    REFERENCES `users`(`id`)
    ON UPDATE no action
    ON DELETE restrict,

  CONSTRAINT "tasks_status_check"
    CHECK(
      `status` in (
        'backlog',
        'todo',
        'in_progress',
        'review',
        'done',
        'cancelled'
      )
    ),

  CONSTRAINT "tasks_priority_check"
    CHECK(
      `priority` is null
      or
      `priority` in (
        'low',
        'medium',
        'high',
        'urgent'
      )
    )
);
--> statement-breakpoint

INSERT INTO `__new_tasks` (
  `id`,
  `project_id`,
  `task_number`,
  `title`,
  `description`,
  `status`,
  `priority`,
  `assignee_id`,
  `start_date`,
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

  ROW_NUMBER() OVER (
    PARTITION BY `project_id`
    ORDER BY
      `created_at` ASC,
      `id` ASC
  ),

  `title`,
  `description`,
  `status`,
  `priority`,
  `assignee_id`,

  strftime(
    '%Y-%m-%d',
    `created_at`,
    'unixepoch'
  ),

  `due_date`,
  `sort_order`,
  `discord_thread_url`,
  `created_by`,
  `created_at`,
  `updated_at`,
  `archived_at`

FROM `tasks`;
--> statement-breakpoint

DROP TABLE `tasks`;
--> statement-breakpoint

ALTER TABLE `__new_tasks`
RENAME TO `tasks`;
--> statement-breakpoint

CREATE INDEX `tasks_project_status_sort_idx`
ON `tasks` (
  `project_id`,
  `status`,
  `sort_order`
);
--> statement-breakpoint

CREATE INDEX `tasks_assignee_id_idx`
ON `tasks` (`assignee_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `tasks_project_number_unique`
ON `tasks` (
  `project_id`,
  `task_number`
);
--> statement-breakpoint

CREATE TABLE `task_assignees` (
  `task_id` text NOT NULL,

  `user_id` text NOT NULL,

  `created_at` integer NOT NULL,

  PRIMARY KEY(
    `task_id`,
    `user_id`
  ),

  FOREIGN KEY (`task_id`)
    REFERENCES `tasks`(`id`)
    ON UPDATE no action
    ON DELETE cascade,

  FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`)
    ON UPDATE no action
    ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX `task_assignees_user_id_idx`
ON `task_assignees` (`user_id`);
--> statement-breakpoint

INSERT INTO `task_assignees` (
  `task_id`,
  `user_id`,
  `created_at`
)
SELECT
  `id`,
  `assignee_id`,
  CAST(strftime('%s', 'now') AS INTEGER)

FROM `tasks`

WHERE
  `assignee_id` IS NOT NULL;
--> statement-breakpoint

PRAGMA defer_foreign_keys = OFF;
