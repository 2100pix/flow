import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";

import type { MemberDto } from "../../shared/contracts/members";
import { createDb } from "../db";
import { users, workspaceMembers } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type MembersEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const membersRoutes = new Hono<MembersEnv>();

membersRoutes.get("/", requireAuth, async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const result = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, auth.workspace.id))
    .orderBy(asc(users.displayName));

  const data: MemberDto[] = result;

  return c.json({
    data,
  });
});
