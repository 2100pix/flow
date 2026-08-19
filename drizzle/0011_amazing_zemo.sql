ALTER TABLE `projects`
ADD COLUMN `lead_user_id`
text
REFERENCES `users`(`id`)
ON DELETE set null;
--> statement-breakpoint

ALTER TABLE `projects`
ADD COLUMN `project_code_override`
text;
--> statement-breakpoint

ALTER TABLE `projects`
ADD COLUMN `engagement_type`
text
DEFAULT 'project'
NOT NULL
CONSTRAINT "projects_engagement_type_check"
CHECK (
	`engagement_type` in ('project', 'retainer')
);
--> statement-breakpoint

CREATE INDEX `projects_lead_user_id_idx`
ON `projects` (`lead_user_id`);