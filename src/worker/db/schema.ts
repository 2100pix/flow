import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { permissionKeys } from "../../shared/permissions";

const permissionKeySql = sql.raw(permissionKeys.map((key) => `'${key.replaceAll("'", "''")}'`).join(", "));

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),

  slug: text("slug").notNull().unique(),

  createdAt: integer("created_at", {
    mode: "timestamp",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp",
  }).notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),

  discordUserId: text("discord_user_id").notNull().unique(),

  displayName: text("display_name").notNull(),

  avatarUrl: text("avatar_url"),

  createdAt: integer("created_at", {
    mode: "timestamp",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp",
  }).notNull(),

  lastLoginAt: integer("last_login_at", {
    mode: "timestamp",
  }),
});

export const workspaceDiscordIntegrations = sqliteTable(
  "workspace_discord_integrations",
  {
    workspaceId: text("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    enabled: integer("enabled", {
      mode: "boolean",
    })
      .default(false)
      .notNull(),

    guildId: text("guild_id"),

    guildName: text("guild_name"),

    projectCategoryId: text("project_category_id"),

    connectedByUserId: text("connected_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    connectedAt: integer("connected_at", {
      mode: "timestamp",
    }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },

  (table) => [
    uniqueIndex("workspace_discord_integrations_guild_id_unique").on(table.guildId),

    index("workspace_discord_integrations_connected_by_user_id_idx").on(table.connectedByUserId),

    check(
      "workspace_discord_integrations_enabled_requires_guild_check",
      sql`
          ${table.enabled} = 0
          or
          ${table.guildId} is not null
        `,
    ),

    check(
      "workspace_discord_integrations_category_requires_guild_check",
      sql`
          ${table.projectCategoryId} is null
          or
          ${table.guildId} is not null
        `,
    ),
  ],
);

export const workspaceMembers = sqliteTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    role: text("role", {
      enum: ["owner", "admin", "member"],
    }).notNull(),

    customRoleId: text("custom_role_id").references(() => workspaceRoles.id, {
      onDelete: "restrict",
    }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId],
    }),

    index("workspace_members_user_id_idx").on(table.userId),

    check("workspace_members_role_check", sql`${table.role} in ('owner', 'admin', 'member')`),

    index("workspace_members_custom_role_id_idx").on(table.customRoleId),
    check("workspace_members_custom_role_check", sql`${table.role} != 'admin' or ${table.customRoleId} is null`),
  ],
);

export const workspaceAccessRequests = sqliteTable(
  "workspace_access_requests",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    requestedAt: integer("requested_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId],
    }),
  ],
);

export const workspaceAccessRequestSessions = sqliteTable(
  "workspace_access_request_sessions",
  {
    id: text("id").primaryKey(),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    expiresAt: integer("expires_at", {
      mode: "timestamp",
    }).notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [uniqueIndex("workspace_access_request_sessions_workspace_user_unique").on(table.workspaceId, table.userId), index("workspace_access_request_sessions_expires_at_idx").on(table.expiresAt)],
);

export const teams = sqliteTable(
  "teams",
  {
    id: text("id").primaryKey(),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("teams_workspace_id_idx").on(table.workspaceId), uniqueIndex("teams_workspace_name_unique").on(table.workspaceId, table.name)],
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, {
        onDelete: "cascade",
      }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.teamId, table.userId],
    }),

    index("team_members_user_id_idx").on(table.userId),
  ],
);

export const workspaceExpertise = sqliteTable(
  "workspace_expertise",
  {
    id: text("id").primaryKey(),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("workspace_expertise_workspace_id_idx").on(table.workspaceId), uniqueIndex("workspace_expertise_workspace_name_unique").on(table.workspaceId, table.name)],
);

export const memberExpertise = sqliteTable(
  "member_expertise",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    expertiseId: text("expertise_id")
      .notNull()
      .references(() => workspaceExpertise.id, {
        onDelete: "cascade",
      }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.expertiseId],
    }),

    index("member_expertise_user_id_idx").on(table.userId),

    index("member_expertise_expertise_id_idx").on(table.expertiseId),
  ],
);

export const workspaceRoles = sqliteTable(
  "workspace_roles",
  {
    id: text("id").primaryKey(),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),
    position: integer("position"),
    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    index("workspace_roles_workspace_id_idx").on(table.workspaceId),
    index("workspace_roles_workspace_position_idx").on(table.workspaceId, table.position),
    uniqueIndex("workspace_roles_workspace_name_unique").on(table.workspaceId, table.name),
  ],
);

export const workspaceRolePermissions = sqliteTable(
  "workspace_role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => workspaceRoles.id, {
        onDelete: "cascade",
      }),

    permissionKey: text("permission_key").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionKey],
    }),

    check("workspace_role_permissions_permission_key_check", sql`${table.permissionKey} in (${permissionKeySql})`),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    expiresAt: integer("expires_at", {
      mode: "timestamp",
    }).notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId), index("sessions_expires_at_idx").on(table.expiresAt)],
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    logoUrl: text("logo_url"),

    status: text("status", {
      enum: ["active", "inactive"],
    }).notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),

    archivedAt: integer("archived_at", {
      mode: "timestamp",
    }),
  },
  (table) => [index("clients_workspace_id_idx").on(table.workspaceId), check("clients_status_check", sql`${table.status} in ('active', 'inactive')`)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    clientId: text("client_id").references(() => clients.id, {
      onDelete: "restrict",
    }),

    leadUserId: text("lead_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    projectCodeOverride: text("project_code_override"),
    description: text("description"),
    engagementType: text("engagement_type", {
      enum: ["project", "retainer"],
    })
      .default("project")
      .notNull(),
    visibility: text("visibility", {
      enum: ["workspace", "private"],
    })
      .default("workspace")
      .notNull(),

    status: text("status", {
      enum: ["planning", "active", "on_hold", "completed"],
    }).notNull(),

    startDate: text("start_date"),
    dueDate: text("due_date"),

    dueDateMode: text("due_date_mode", {
      enum: ["unset", "date", "ongoing"],
    })
      .default("unset")
      .notNull(),

    discordChannelUrl: text("discord_channel_url"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),

    archivedAt: integer("archived_at", {
      mode: "timestamp",
    }),
  },
  (table) => [
    index("projects_workspace_id_idx").on(table.workspaceId),
    index("projects_client_id_idx").on(table.clientId),
    index("projects_lead_user_id_idx").on(table.leadUserId),

    check("projects_engagement_type_check", sql`${table.engagementType} in ('project', 'retainer')`),
    check("projects_due_date_mode_check", sql`${table.dueDateMode} in ('unset', 'date', 'ongoing')`),
    check("projects_visibility_check", sql`${table.visibility} in ('workspace', 'private')`),
    check("projects_status_check", sql`${table.status} in ('planning', 'active', 'on_hold', 'completed')`),
  ],
);

export const projectDiscordForums = sqliteTable(
  "project_discord_forums",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    guildId: text("guild_id").notNull(),

    forumChannelId: text("forum_channel_id"),

    provisioningStatus: text("provisioning_status", {
      enum: ["pending", "ready", "error"],
    })
      .default("pending")
      .notNull(),

    attemptCount: integer("attempt_count").default(0).notNull(),

    lastError: text("last_error"),

    lastAttemptAt: integer("last_attempt_at", {
      mode: "timestamp",
    }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },

  (table) => [
    uniqueIndex("project_discord_forums_forum_channel_id_unique").on(table.forumChannelId),

    index("project_discord_forums_guild_id_idx").on(table.guildId),

    index("project_discord_forums_provisioning_status_idx").on(table.provisioningStatus),

    check(
      "project_discord_forums_status_check",
      sql`
          ${table.provisioningStatus}
          in (
            'pending',
            'ready',
            'error'
          )
        `,
    ),

    check(
      "project_discord_forums_ready_channel_check",
      sql`
          ${table.provisioningStatus} != 'ready'
          or
          ${table.forumChannelId} is not null
        `,
    ),

    check(
      "project_discord_forums_attempt_count_check",
      sql`
          ${table.attemptCount} >= 0
        `,
    ),
  ],
);

export const projectMembers = sqliteTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.userId],
    }),

    index("project_members_user_id_idx").on(table.userId),
  ],
);

export const projectLeads = sqliteTable(
  "project_leads",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    position: integer("position").notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.userId],
    }),

    uniqueIndex("project_leads_project_position_unique").on(table.projectId, table.position),

    index("project_leads_user_id_idx").on(table.userId),

    check("project_leads_position_check", sql`${table.position} >= 0 and ${table.position} <= 2`),
  ],
);

export const projectResources = sqliteTable(
  "project_resources",
  {
    id: text("id").primaryKey(),

    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    type: text("type", {
      enum: ["document_brief", "link"],
    }).notNull(),

    title: text("title"),

    url: text("url"),

    content: text("content"),

    position: integer("position").notNull(),

    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    index("project_resources_project_id_idx").on(table.projectId),

    uniqueIndex("project_resources_project_position_unique").on(table.projectId, table.position),

    check("project_resources_type_check", sql`${table.type} in ('document_brief', 'link')`),

    check("project_resources_position_check", sql`${table.position} >= 0`),

    check(
      "project_resources_payload_check",
      sql`(
        (${table.type} = 'link' and ${table.url} is not null and ${table.content} is null)
        or
        (${table.type} = 'document_brief' and ${table.url} is null)
      )`,
    ),
  ],
);

export const projectTaskStatuses = sqliteTable(
  "project_task_statuses",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    statusKey: text("status_key", {
      enum: ["backlog", "todo", "in_progress", "review", "done", "cancelled"],
    }).notNull(),

    label: text("label").notNull(),

    position: integer("position").notNull(),

    enabled: integer("enabled", {
      mode: "boolean",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.statusKey],
    }),

    uniqueIndex("project_task_statuses_project_position_unique").on(table.projectId, table.position),

    check("project_task_statuses_status_key_check", sql`${table.statusKey} in ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled')`),
    check("project_task_statuses_position_check", sql`${table.position} >= 0`),
    check("project_task_statuses_enabled_check", sql`${table.enabled} in (0, 1)`),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),

    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),
    taskNumber: integer("task_number").notNull(),
    title: text("title").notNull(),

    description: text("description"),

    status: text("status", {
      enum: ["backlog", "todo", "in_progress", "review", "done", "cancelled"],
    }).notNull(),

    priority: text("priority", {
      enum: ["low", "medium", "high", "urgent"],
    }),

    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),

    leadUserId: text("lead_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    startDate: text("start_date").notNull(),
    dueDate: text("due_date"),
    sortOrder: integer("sort_order").notNull(),
    discordThreadUrl: text("discord_thread_url"),

    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),

    archivedAt: integer("archived_at", {
      mode: "timestamp",
    }),
  },
  (table) => [
    uniqueIndex("tasks_project_number_unique").on(table.projectId, table.taskNumber),
    index("tasks_project_status_sort_idx").on(table.projectId, table.status, table.sortOrder),
    index("tasks_assignee_id_idx").on(table.assigneeId),
    index("tasks_lead_user_id_idx").on(table.leadUserId),
    check("tasks_status_check", sql`${table.status} in ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled')`),
    check("tasks_priority_check", sql`${table.priority} is null or ${table.priority} in ('low', 'medium', 'high', 'urgent')`),
  ],
);

export const projectTaskSequences = sqliteTable(
  "project_task_sequences",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    nextNumber: integer("next_number").notNull(),
  },
  (table) => [check("project_task_sequences_next_number_check", sql`${table.nextNumber} >= 1`)],
);

export const taskAssignees = sqliteTable(
  "task_assignees",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, {
        onDelete: "cascade",
      }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.taskId, table.userId],
    }),

    index("task_assignees_user_id_idx").on(table.userId),
  ],
);

export const taskResources = sqliteTable(
  "task_resources",
  {
    id: text("id").primaryKey(),

    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, {
        onDelete: "cascade",
      }),

    type: text("type", {
      enum: ["document_brief", "link"],
    }).notNull(),

    title: text("title"),

    url: text("url"),

    content: text("content"),

    position: integer("position").notNull(),

    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
      }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    index("task_resources_task_id_idx").on(table.taskId),

    uniqueIndex("task_resources_task_position_unique").on(table.taskId, table.position),

    check("task_resources_type_check", sql`${table.type} in ('document_brief', 'link')`),

    check("task_resources_position_check", sql`${table.position} >= 0`),

    check(
      "task_resources_payload_check",
      sql`(
        (
          ${table.type} = 'link'
          and ${table.url} is not null
          and ${table.content} is null
        )
        or
        (
          ${table.type} = 'document_brief'
          and ${table.url} is null
        )
      )`,
    ),
  ],
);

export const discordOutboxEvents = sqliteTable(
  "discord_outbox_events",
  {
    id: text("id").primaryKey(),

    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),

    aggregateType: text("aggregate_type", {
      enum: ["project_forum", "task_thread"],
    }).notNull(),

    aggregateId: text("aggregate_id").notNull(),

    eventType: text("event_type", {
      enum: ["project_forum.provision", "task_thread.provision"],
    }).notNull(),

    status: text("status", {
      enum: ["pending", "dispatched"],
    })
      .default("pending")
      .notNull(),

    dispatchAttemptCount: integer("dispatch_attempt_count").default(0).notNull(),

    lastDispatchError: text("last_dispatch_error"),

    dispatchedAt: integer("dispatched_at", {
      mode: "timestamp",
    }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },

  (table) => [
    uniqueIndex("discord_outbox_events_event_aggregate_unique").on(table.eventType, table.aggregateId),

    index("discord_outbox_events_status_idx").on(table.status),

    index("discord_outbox_events_workspace_id_idx").on(table.workspaceId),

    check(
      "discord_outbox_events_status_check",
      sql`
          ${table.status}
          in (
            'pending',
            'dispatched'
          )
        `,
    ),

    check(
      "discord_outbox_events_dispatch_attempt_count_check",
      sql`
          ${table.dispatchAttemptCount} >= 0
        `,
    ),
  ],
);

export const taskDiscordThreads = sqliteTable(
  "task_discord_threads",
  {
    taskId: text("task_id")
      .primaryKey()
      .references(() => tasks.id, {
        onDelete: "cascade",
      }),

    guildId: text("guild_id").notNull(),

    forumChannelId: text("forum_channel_id"),
    threadId: text("thread_id").unique(),

    initialMessageId: text("initial_message_id").unique(),

    provisioningStatus: text("provisioning_status", {
      enum: ["pending", "ready", "error"],
    })
      .default("pending")
      .notNull(),

    attemptCount: integer("attempt_count").default(0).notNull(),

    lastError: text("last_error"),

    lastAttemptAt: integer("last_attempt_at", {
      mode: "timestamp",
    }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },

  (table) => [
    index("task_discord_threads_guild_id_idx").on(table.guildId),

    index("task_discord_threads_forum_channel_id_idx").on(table.forumChannelId),

    index("task_discord_threads_provisioning_status_idx").on(table.provisioningStatus),

    check(
      "task_discord_threads_provisioning_status_check",
      sql`
          ${table.provisioningStatus}
          in (
            'pending',
            'ready',
            'error'
          )
        `,
    ),

    check(
      "task_discord_threads_ready_requires_ids_check",
      sql`
        ${table.provisioningStatus} <> 'ready'
        or (
          ${table.forumChannelId} is not null
          and
          ${table.threadId} is not null
          and
          ${table.initialMessageId} is not null
        )
      `,
    ),

    check(
      "task_discord_threads_attempt_count_check",
      sql`
          ${table.attemptCount} >= 0
        `,
    ),
  ],
);
