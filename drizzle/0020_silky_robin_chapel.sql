CREATE TABLE `discord_outbox_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`dispatch_attempt_count` integer DEFAULT 0 NOT NULL,
	`last_dispatch_error` text,
	`dispatched_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "discord_outbox_events_status_check" CHECK(
          "discord_outbox_events"."status"
          in (
            'pending',
            'dispatched'
          )
        ),
	CONSTRAINT "discord_outbox_events_dispatch_attempt_count_check" CHECK(
          "discord_outbox_events"."dispatch_attempt_count" >= 0
        )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_outbox_events_event_aggregate_unique` ON `discord_outbox_events` (`event_type`,`aggregate_id`);--> statement-breakpoint
CREATE INDEX `discord_outbox_events_status_idx` ON `discord_outbox_events` (`status`);--> statement-breakpoint
CREATE INDEX `discord_outbox_events_workspace_id_idx` ON `discord_outbox_events` (`workspace_id`);