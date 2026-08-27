type EntityPrefix = "ws" | "usr" | "cl" | "prj" | "tsk" | "team" | "role" | "res" | "exp" | "obx" | "act";

export function createId(prefix: EntityPrefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
