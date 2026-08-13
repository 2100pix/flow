import { Hono } from "hono";

import { requireAuth } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

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
