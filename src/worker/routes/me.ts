import { and, asc, eq, inArray } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import {
  createWorkspaceExpertiseSchema,
  updateMemberExpertiseSchema,
  type WorkspaceExpertiseDto,
} from "../../shared/contracts/members";
import { updateProfileSchema, type UserProfileDto } from "../../shared/contracts/me";
import { createDb } from "../db";
import { createId } from "../lib/id";
import { memberExpertise, users, workspaceExpertise } from "../db/schema";
import { requireAuth } from "../middleware/auth";

import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: value,
    }).format(new Date());

    return true;
  } catch {
    return false;
  }
}

type MeEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const meRoutes = new Hono<MeEnv>();

meRoutes.get("/", requireAuth, (c) => {
  return c.json({
    data: c.var.auth,
  });
});

meRoutes.put(
  "/profile",

  requireAuth,

  zValidator(
    "json",

    updateProfileSchema,

    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",

              message: "Invalid profile data",
            },
          },
          400,
        );
      }
    },
  ),

  async (c) => {
    const auth = c.var.auth;

    const input = c.req.valid("json");

    if (input.timeZone !== null && !isValidTimeZone(input.timeZone)) {
      return c.json(
        {
          error: {
            code: "INVALID_TIME_ZONE",

            message: "Invalid time zone",
          },
        },
        400,
      );
    }

    const db = createDb(c.env.flow_db);

    const now = new Date();

    await db
      .update(users)
      .set({
        firstName: input.firstName,

        lastName: input.lastName,

        timeZone: input.timeZone,

        updatedAt: now,
      })
      .where(eq(users.id, auth.user.id));

    const data: UserProfileDto = {
      id: auth.user.id,

      displayName: auth.user.displayName,

      avatarUrl: auth.user.avatarUrl,

      firstName: input.firstName,

      lastName: input.lastName,

      timeZone: input.timeZone,

      expertise: auth.user.expertise,
    };

    return c.json({
      data,
    });
  },
);

meRoutes.get("/expertise", requireAuth, async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const rows = await db
    .select({
      id: workspaceExpertise.id,

      name: workspaceExpertise.name,

      createdAt: workspaceExpertise.createdAt,
    })
    .from(workspaceExpertise)
    .where(eq(workspaceExpertise.workspaceId, auth.workspace.id))
    .orderBy(asc(workspaceExpertise.name));

  const data: WorkspaceExpertiseDto[] = rows.map((row) => ({
    id: row.id,

    name: row.name,

    createdAt: row.createdAt.toISOString(),
  }));

  return c.json({
    data,
  });
});

meRoutes.post(
  "/expertise",

  requireAuth,

  zValidator(
    "json",

    createWorkspaceExpertiseSchema,

    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",

              message: "Invalid expertise data",
            },
          },
          400,
        );
      }
    },
  ),

  async (c) => {
    const auth = c.var.auth;

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const existing = await db
      .select({
        id: workspaceExpertise.id,

        name: workspaceExpertise.name,
      })
      .from(workspaceExpertise)
      .where(eq(workspaceExpertise.workspaceId, auth.workspace.id));

    const duplicate = existing.some((expertise) => expertise.name.trim().toLowerCase() === input.name.trim().toLowerCase());

    if (duplicate) {
      return c.json(
        {
          error: {
            code: "EXPERTISE_NAME_TAKEN",

            message: "Expertise already exists",
          },
        },
        409,
      );
    }

    const id = createId("exp");

    const now = new Date();

    await db.insert(workspaceExpertise).values({
      id,

      workspaceId: auth.workspace.id,

      name: input.name,

      createdAt: now,

      updatedAt: now,
    });

    const data: WorkspaceExpertiseDto = {
      id,

      name: input.name,

      createdAt: now.toISOString(),
    };

    return c.json(
      {
        data,
      },
      201,
    );
  },
);

meRoutes.put(
  "/expertise",

  requireAuth,

  zValidator(
    "json",

    updateMemberExpertiseSchema,

    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",

              message: "Invalid member expertise",
            },
          },
          400,
        );
      }
    },
  ),

  async (c) => {
    const auth = c.var.auth;

    const userId = auth.user.id;

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const available = await db
      .select({
        id: workspaceExpertise.id,
      })
      .from(workspaceExpertise)
      .where(eq(workspaceExpertise.workspaceId, auth.workspace.id));

    const availableIds = new Set(available.map((item) => item.id));

    if (input.expertiseIds.some((id) => !availableIds.has(id))) {
      return c.json(
        {
          error: {
            code: "EXPERTISE_NOT_AVAILABLE",

            message: "Expertise is not available in this workspace",
          },
        },
        400,
      );
    }

    const workspaceExpertiseIds = [...availableIds];

    const deletes =
      workspaceExpertiseIds.length > 0
        ? db.delete(memberExpertise).where(
            and(
              eq(memberExpertise.userId, userId),

              inArray(memberExpertise.expertiseId, workspaceExpertiseIds),
            ),
          )
        : null;

    const now = new Date();

    if (input.expertiseIds.length > 0) {
      const insert = db.insert(memberExpertise).values(
        input.expertiseIds.map((expertiseId) => ({
          userId,

          expertiseId,

          createdAt: now,
        })),
      );

      if (deletes) {
        await db.batch([deletes, insert]);
      } else {
        await insert;
      }
    } else if (deletes) {
      await deletes;
    }

    return c.json({
      data: {
        success: true as const,
      },
    });
  },
);
