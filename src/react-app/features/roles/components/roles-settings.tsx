import { useState } from "react";

import { CheckIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { hasPermission } from "@/features/auth/permissions";

import { useMe } from "@/features/auth/hooks/use-me";

import { useCreateRole, useDeleteRole, useUpdateRole } from "@/features/roles/hooks/use-role-mutations";

import { useRoles } from "@/features/roles/hooks/use-roles";

import type { RoleDto } from "@/features/roles/types";

import { cn } from "@/lib/utils";

import { permissionCatalog, permissionKeys, type PermissionKey } from "../../../../shared/permissions";

import { administratorPermissionGroups, builtInPermissionPresets, clientPermissionGroups, projectPermissionGroups, taskPermissionGroups, viewOnlyPermissionGroups, type PermissionGroup } from "../../../../shared/role-permission-groups";

import { viewOnlyWorkspacePermissions } from "../../../../shared/roles";

import { PermissionSelector } from "./permission-selector";

function samePermissions(first: readonly PermissionKey[], second: readonly PermissionKey[]) {
  if (first.length !== second.length) {
    return false;
  }

  const selected = new Set(first);

  return second.every((permission) => selected.has(permission));
}

function hasAllPermissions(value: readonly PermissionKey[], required: readonly PermissionKey[]) {
  const selected = new Set(value);

  return required.every((permission) => selected.has(permission));
}

function getCustomAccessLabels(role: RoleDto) {
  if (samePermissions(role.permissions, permissionKeys)) {
    return ["Full Control"];
  }

  if (samePermissions(role.permissions, viewOnlyWorkspacePermissions)) {
    return ["Only workspace"];
  }

  const selected = new Set(role.permissions);

  const consumed = new Set<PermissionKey>();

  const labels: string[] = [];

  const aggregateGroups: readonly PermissionGroup[] = [...administratorPermissionGroups.filter((group) => group.id !== "full-control"), ...viewOnlyPermissionGroups, ...clientPermissionGroups, ...projectPermissionGroups, ...taskPermissionGroups];

  for (const group of aggregateGroups) {
    if (!hasAllPermissions(role.permissions, group.permissions)) {
      continue;
    }

    const alreadyConsumed = group.permissions.every((permission) => consumed.has(permission));

    if (alreadyConsumed) {
      continue;
    }

    labels.push(group.label);

    for (const permission of group.permissions) {
      consumed.add(permission);
    }
  }

  for (const permission of role.permissions) {
    if (consumed.has(permission)) {
      continue;
    }

    if (!selected.has(permission)) {
      continue;
    }

    const definition = permissionCatalog.find((item) => item.key === permission);

    if (definition) {
      labels.push(definition.label);
    }
  }

  return labels.length > 0 ? labels : ["No access"];
}

function getRoleAccessLabels(role: RoleDto) {
  if (role.systemKey === "owner") {
    return ["Full Control"];
  }

  if (role.systemKey === "admin") {
    return ["Manage members", "Manage teams", "Manage clients", "Manage projects", "Manage tasks"];
  }

  if (role.systemKey === "member") {
    return ["Only workspace"];
  }

  return getCustomAccessLabels(role);
}

function AccessSummary({
  role,
  onOpen,
}: {
  role: RoleDto;

  onOpen: () => void;
}) {
  const labels = getRoleAccessLabels(role);

  const visible = labels.slice(0, 3);

  const hidden = labels.slice(3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="
        flex min-h-8
        min-w-0
        items-center
        gap-1.5
        text-left
        outline-none
      "
    >
      {visible.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className="
              shrink-0
              font-normal
              text-muted-foreground
              transition-colors
              hover:text-foreground
            "
        >
          {label}
        </Badge>
      ))}

      {hidden.length > 0 ? (
        <HoverCard>
          <HoverCardTrigger render={<span className="inline-flex shrink-0" />}>
            <Badge
              variant="outline"
              className="
                cursor-default
                font-normal
                text-muted-foreground
              "
            >
              +{hidden.length}
            </Badge>
          </HoverCardTrigger>

          <HoverCardContent side="top" align="start" className="w-auto max-w-72 p-2">
            <div className="flex max-w-64 flex-wrap gap-1.5">
              {hidden.map((label) => (
                <Badge key={label} variant="outline" className="font-normal">
                  {label}
                </Badge>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      ) : null}
    </button>
  );
}

function BuiltInPresetSelector({
  permissions,
  onChange,
  disabled,
}: {
  permissions: PermissionKey[];

  onChange: (permissions: PermissionKey[]) => void;

  disabled: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">Built in Permission</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {builtInPermissionPresets.map((preset) => {
          const active = samePermissions(permissions, preset.permissions);

          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange([...preset.permissions]);
              }}
              className={cn(
                `
                    inline-flex h-7
                    items-center gap-1.5
                    rounded-full
                    border border-border
                    px-2.5
                    text-xs
                    transition-colors
                  `,

                active ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",

                disabled && "cursor-default opacity-60",
              )}
            >
              {preset.label}

              {active ? <CheckIcon className="size-3.5" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RoleDialog({
  mode,
  role,
  canManage,
  onClose,
}: {
  mode: "create" | "edit";

  role?: RoleDto;

  canManage: boolean;

  onClose: () => void;
}) {
  const createRole = useCreateRole();

  const updateRole = useUpdateRole();

  const deleteRole = useDeleteRole();

  const [deleteOpen, setDeleteOpen] = useState(false);

  const [name, setName] = useState(() => role?.name ?? "");

  const [permissions, setPermissions] = useState<PermissionKey[]>(() => (role ? [...role.permissions] : []));

  const editing = mode === "edit";

  const builtIn = role?.kind === "built_in";

  const readOnly = editing && (builtIn || !canManage);

  const canDelete = editing && role?.kind === "custom" && canManage;

  const normalizedName = name.trim();

  const isPending = createRole.isPending || updateRole.isPending || deleteRole.isPending;

  const hasChanges = role ? normalizedName !== role.name || !samePermissions(permissions, role.permissions) : Boolean(normalizedName);

  const error = createRole.error ?? updateRole.error ?? deleteRole.error;

  function submit() {
    if (readOnly || !normalizedName || isPending) {
      return;
    }

    if (mode === "create") {
      createRole.mutate(
        {
          name: normalizedName,

          permissions,
        },
        {
          onSuccess: onClose,
        },
      );

      return;
    }

    if (!role || role.kind !== "custom") {
      return;
    }

    updateRole.mutate(
      {
        roleId: role.id,

        name: normalizedName,

        permissions,
      },
      {
        onSuccess: onClose,
      },
    );
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isPending) {
            onClose();
          }
        }}
      >
        <DialogContent
          showCloseButton={!isPending}
          className="
            w-[760px]
            max-w-[calc(100vw-2rem)]!
            sm:max-w-[760px]!
            max-h-[calc(100vh-4rem)]
            overflow-y-auto
            rounded-[10px]
            p-6
          "
        >
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Create role" : "Edit role"}</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-7"
            onSubmit={(event) => {
              event.preventDefault();

              submit();
            }}
          >
            <div>
              <label htmlFor="role-name" className="text-sm text-muted-foreground">
                Name Role
              </label>

              <input
                id="role-name"
                value={name}
                maxLength={120}
                autoFocus={mode === "create"}
                disabled={readOnly || isPending}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                className="
                  mt-3 h-9 w-full
                  rounded-lg border
                  border-input
                  bg-background
                  px-3 text-sm
                  outline-none
                  focus-visible:border-ring
                  focus-visible:ring-3
                  focus-visible:ring-ring/50
                  disabled:opacity-60
                "
              />
            </div>

            <BuiltInPresetSelector permissions={permissions} onChange={setPermissions} disabled={readOnly || isPending} />

            <div>
              <p className="mb-5 text-sm text-muted-foreground">Access / Permission</p>

              <PermissionSelector value={permissions} onChange={setPermissions} disabled={readOnly || isPending} />
            </div>

            {builtIn ? <p className="text-xs text-muted-foreground">Built-in role permissions are managed by Flow and cannot be edited.</p> : null}

            {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

            <div
              className={cn(
                "flex items-center pt-3",

                canDelete ? "justify-between" : "justify-end",
              )}
            >
              {canDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => {
                    setDeleteOpen(true);
                  }}
                >
                  Delete role
                </Button>
              ) : null}

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" disabled={isPending} onClick={onClose}>
                  {readOnly ? "Close" : "Cancel"}
                </Button>

                {!readOnly ? (
                  <Button type="submit" disabled={!normalizedName || !hasChanges || isPending}>
                    {isPending ? (mode === "create" ? "Creating…" : "Saving…") : mode === "create" ? "Create role" : "Save role"}
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {canDelete && role ? (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete role?</AlertDialogTitle>

              <AlertDialogDescription>
                The role &quot;
                {role.name}
                &quot; will be permanently deleted. Members using this role must be reassigned first.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteRole.isPending}>Cancel</AlertDialogCancel>

              <AlertDialogAction
                variant="destructive"
                disabled={deleteRole.isPending}
                onClick={() => {
                  deleteRole.mutate(role.id, {
                    onSuccess: () => {
                      setDeleteOpen(false);

                      onClose();
                    },
                  });
                }}
              >
                {deleteRole.isPending ? "Deleting…" : "Delete role"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

export function RolesSettings() {
  const { data: auth } = useMe();

  const { data: roles = [], isPending, isError } = useRoles();

  const canManage = hasPermission(auth, "roles.manage");

  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);

  const [editingRole, setEditingRole] = useState<RoleDto | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredRoles = normalizedQuery ? roles.filter((role) => role.name.toLowerCase().includes(normalizedQuery)) : roles;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Roles</h1>

      <div className="mt-8">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <div className="relative w-full max-w-xs">
            <MagnifyingGlassIcon
              className="
                pointer-events-none
                absolute left-2.5 top-1/2
                size-3.5
                -translate-y-1/2
                text-muted-foreground
              "
              aria-hidden="true"
            />

            <input
              value={query}
              placeholder="Filter by name"
              aria-label="Filter roles by name"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              className="
                h-8 w-full
                rounded-lg
                border border-input
                bg-background
                pr-3 pl-8
                text-xs
                outline-none
                placeholder:text-muted-foreground
                focus-visible:border-ring
                focus-visible:ring-3
                focus-visible:ring-ring/50
              "
            />
          </div>

          {canManage ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setCreateOpen(true);
              }}
            >
              <PlusIcon aria-hidden="true" />
              Create role
            </Button>
          ) : null}
        </div>

        {isPending ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading roles…</div>
        ) : isError ? (
          <div className="py-20 text-center text-sm text-destructive">Unable to load roles.</div>
        ) : filteredRoles.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">No roles found.</div>
        ) : (
          <div className="mt-6">
            <div
              className="
                grid h-8
                grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.2fr)]
                items-center
                border-b border-border
                text-[11px]
                text-muted-foreground
              "
            >
              <span>Name</span>

              <span>Access</span>
            </div>

            {filteredRoles.map((role) => (
              <div
                key={role.id}
                className="
                    grid min-h-12
                    grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.2fr)]
                    items-center
                    border-b border-border/60
                    text-sm
                  "
              >
                <div className="flex min-w-0 items-center gap-2 pr-4">
                  <span className="truncate">{role.name}</span>

                  {role.kind === "built_in" ? (
                    <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-muted-foreground">
                      Built-in
                    </Badge>
                  ) : null}
                </div>

                <AccessSummary
                  role={role}
                  onOpen={() => {
                    setEditingRole(role);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen ? (
        <RoleDialog
          key="create-role"
          mode="create"
          canManage={canManage}
          onClose={() => {
            setCreateOpen(false);
          }}
        />
      ) : null}

      {editingRole ? (
        <RoleDialog
          key={editingRole.id}
          mode="edit"
          role={editingRole}
          canManage={canManage}
          onClose={() => {
            setEditingRole(null);
          }}
        />
      ) : null}
    </div>
  );
}
