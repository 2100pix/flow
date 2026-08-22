import { CheckIcon } from "@phosphor-icons/react";

import type { PermissionKey } from "../../../../shared/permissions";

import { administratorPermissionGroups, clientPermissionGroups, projectPermissionGroups, taskPermissionGroups, viewOnlyPermissionGroups, type PermissionGroup } from "../../../../shared/role-permission-groups";

import { cn } from "@/lib/utils";

function hasAllPermissions(value: readonly PermissionKey[], group: readonly PermissionKey[]) {
  const selected = new Set(value);

  return group.every((permission) => selected.has(permission));
}

function PermissionChip({
  group,
  value,
  onChange,
  disabled,
}: {
  group: PermissionGroup;

  value: PermissionKey[];

  onChange: (permissions: PermissionKey[]) => void;

  disabled: boolean;
}) {
  const selected = hasAllPermissions(value, group.permissions);

  function toggle() {
    if (disabled) {
      return;
    }

    const next = new Set(value);

    if (selected) {
      for (const permission of group.permissions) {
        next.delete(permission);
      }
    } else {
      for (const permission of group.permissions) {
        next.add(permission);
      }
    }

    onChange([...next]);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={toggle}
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

        selected ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",

        disabled && "cursor-default opacity-60",
      )}
    >
      {group.label}

      {selected ? <CheckIcon className="size-3.5" aria-hidden="true" /> : null}
    </button>
  );
}

function PermissionSection({
  title,
  groups,
  value,
  onChange,
  disabled,
}: {
  title: string;

  groups: readonly PermissionGroup[];

  value: PermissionKey[];

  onChange: (permissions: PermissionKey[]) => void;

  disabled: boolean;
}) {
  return (
    <section>
      <p className="text-sm text-muted-foreground">{title}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {groups.map((group) => (
          <PermissionChip key={group.id} group={group} value={value} onChange={onChange} disabled={disabled} />
        ))}
      </div>
    </section>
  );
}

export function PermissionSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: PermissionKey[];

  onChange: (permissions: PermissionKey[]) => void;

  disabled?: boolean;
}) {
  return (
    <div className="space-y-5">
      <PermissionSection title="Administrator" groups={administratorPermissionGroups} value={value} onChange={onChange} disabled={disabled} />

      <PermissionSection title="Clients" groups={clientPermissionGroups} value={value} onChange={onChange} disabled={disabled} />

      <PermissionSection title="Projects" groups={projectPermissionGroups} value={value} onChange={onChange} disabled={disabled} />

      <PermissionSection title="Tasks" groups={taskPermissionGroups} value={value} onChange={onChange} disabled={disabled} />

      <PermissionSection title="View only" groups={viewOnlyPermissionGroups} value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}
