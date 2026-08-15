import { useState } from "react";
import { PencilSimpleIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";
import { useCreateRole, useDeleteRole, useUpdateRole } from "@/features/roles/hooks/use-role-mutations";
import { useRoles } from "@/features/roles/hooks/use-roles";
import type { RoleDto } from "@/features/roles/types";
import { hasFullControl } from "../../../../shared/roles";
import type { PermissionKey } from "../../../../shared/permissions";
import { PermissionSelector } from "./permission-selector";
import { hasPermission } from "@/features/auth/permissions";

function BuiltInRoleCard({ role }: { role: RoleDto }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{role.name}</p>

            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">Built-in</span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">{hasFullControl(role.permissions) ? "Full Control" : `${role.permissions.length} permissions`}</p>
        </div>
      </div>
    </div>
  );
}

function CustomRoleCard({ role }: { role: RoleDto }) {
  const updateRole = useUpdateRole();

  const deleteRole = useDeleteRole();

  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(role.name);

  const [permissions, setPermissions] = useState<PermissionKey[]>(role.permissions);

  function beginEditing() {
    setName(role.name);

    setPermissions(role.permissions);

    setEditing(true);
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();

            const value = name.trim();

            if (!value) {
              return;
            }

            updateRole.mutate(
              {
                roleId: role.id,
                name: value,
                permissions,
              },
              {
                onSuccess: () => {
                  setEditing(false);
                },
              },
            );
          }}
        >
          <div className="flex items-start gap-2">
            <input
              value={name}
              maxLength={120}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel editing"
              onClick={() => {
                setEditing(false);
              }}
            >
              <XIcon />
            </Button>
          </div>

          <PermissionSelector value={permissions} onChange={setPermissions} />

          {updateRole.isError && <p className="text-sm text-destructive">{updateRole.error.message}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={!name.trim() || updateRole.isPending}>
              {updateRole.isPending ? "Saving…" : "Save role"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{role.name}</p>

            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">Custom</span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">{hasFullControl(role.permissions) ? "Full Control" : `${role.permissions.length} permissions`}</p>
        </div>

        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon-sm" title="Edit role" aria-label={`Edit ${role.name}`} onClick={beginEditing}>
            <PencilSimpleIcon />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Delete role"
            aria-label={`Delete ${role.name}`}
            disabled={deleteRole.isPending}
            onClick={() => {
              if (!window.confirm(`Delete role "${role.name}"?`)) {
                return;
              }

              deleteRole.mutate(role.id);
            }}
          >
            <TrashIcon />
          </Button>
        </div>
      </div>

      {deleteRole.isError && <p className="mt-3 text-sm text-destructive">{deleteRole.error.message}</p>}
    </div>
  );
}

export function RolesSettings() {
  const { data: auth } = useMe();

  const { data: roles = [], isPending, isError } = useRoles();

  const createRole = useCreateRole();

  const [name, setName] = useState("");

  const [permissions, setPermissions] = useState<PermissionKey[]>([]);

  const canManage = hasPermission(auth, "roles.manage");
  const builtInRoles = roles.filter((role) => role.kind === "built_in");

  const customRoles = roles.filter((role) => role.kind === "custom");

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Roles & Permissions</h2>

        <p className="mt-1 text-sm text-muted-foreground">Control workspace capabilities through built-in and custom roles.</p>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading roles…</p>}

      {isError && <p className="text-sm text-destructive">Unable to load roles.</p>}

      {!isPending && !isError && (
        <>
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Built-in roles</p>

            <div className="grid gap-3 sm:grid-cols-3">
              {builtInRoles.map((role) => (
                <BuiltInRoleCard key={role.id} role={role} />
              ))}
            </div>
          </div>

          {canManage && (
            <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();

                  const value = name.trim();

                  if (!value) {
                    return;
                  }

                  createRole.mutate(
                    {
                      name: value,
                      permissions,
                    },
                    {
                      onSuccess: () => {
                        setName("");

                        setPermissions([]);
                      },
                    },
                  );
                }}
              >
                <div>
                  <h3 className="text-sm font-semibold">Create custom role</h3>

                  <p className="mt-1 text-xs text-muted-foreground">Choose only the capabilities this role requires.</p>
                </div>

                <input
                  value={name}
                  maxLength={120}
                  placeholder="Designer"
                  onChange={(event) => {
                    setName(event.target.value);
                  }}
                  className="h-9 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />

                <PermissionSelector value={permissions} onChange={setPermissions} />

                {createRole.isError && <p className="text-sm text-destructive">{createRole.error.message}</p>}

                <Button type="submit" disabled={!name.trim() || createRole.isPending}>
                  <PlusIcon />

                  {createRole.isPending ? "Creating…" : "Create role"}
                </Button>
              </form>
            </div>
          )}

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Custom roles</p>

            {customRoles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8">
                <p className="text-sm text-muted-foreground">No custom roles yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customRoles.map((role) => (
                  <CustomRoleCard key={role.id} role={role} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
