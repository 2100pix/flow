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
    check("workspace_members_custom_role_check", sql`${table.role} = 'member' or ${table.customRoleId} is null`),
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

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("workspace_roles_workspace_id_idx").on(table.workspaceId), uniqueIndex("workspace_roles_workspace_name_unique").on(table.workspaceId, table.name)],
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

    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, {
        onDelete: "restrict",
      }),

    name: text("name").notNull(),

    description: text("description"),

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

    check("projects_visibility_check", sql`${table.visibility} in ('workspace', 'private')`),

    check("projects_status_check", sql`${table.status} in ('planning', 'active', 'on_hold', 'completed')`),
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

export const projectTaskStatuses = sqliteTable(
  "project_task_statuses",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
      }),

    statusKey: text("status_key", {
      enum: ["backlog", "todo", "in_progress", "review", "done"],
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

    check("project_task_statuses_status_key_check", sql`${table.statusKey} in ('backlog', 'todo', 'in_progress', 'review', 'done')`),

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

    title: text("title").notNull(),

    description: text("description"),

    status: text("status", {
      enum: ["backlog", "todo", "in_progress", "review", "done"],
    }).notNull(),

    priority: text("priority", {
      enum: ["low", "medium", "high", "urgent"],
    }),

    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),

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
    index("tasks_project_status_sort_idx").on(table.projectId, table.status, table.sortOrder),

    index("tasks_assignee_id_idx").on(table.assigneeId),

    check("tasks_status_check", sql`${table.status} in ('backlog', 'todo', 'in_progress', 'review', 'done')`),

    check("tasks_priority_check", sql`${table.priority} is null or ${table.priority} in ('low', 'medium', 'high', 'urgent')`),
  ],
);
