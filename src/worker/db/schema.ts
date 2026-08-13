import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
