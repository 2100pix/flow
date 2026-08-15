import { useMe } from "@/features/auth/hooks/use-me";
import { useMembers } from "@/features/members/hooks/use-members";
import { useUpdateMemberRole } from "@/features/members/hooks/use-update-member-role";
import type { MemberDto, UpdateWorkspaceMemberRoleInput, WorkspaceRole } from "@/features/members/types";
import { useRoles } from "@/features/roles/hooks/use-roles";

function getMemberRoleValue(member: MemberDto) {
  if (member.customRole) {
    return `custom:${member.customRole.id}`;
  }

  return `builtin:${member.role}`;
}

function parseRoleValue(value: string): UpdateWorkspaceMemberRoleInput | null {
  if (value.startsWith("custom:")) {
    const roleId = value.slice("custom:".length);

    if (!roleId) {
      return null;
    }

    return {
      kind: "custom",
      roleId,
    };
  }

  if (value.startsWith("builtin:")) {
    const role = value.slice("builtin:".length);

    if (role !== "owner" && role !== "admin" && role !== "member") {
      return null;
    }

    return {
      kind: "built_in",
      role: role as WorkspaceRole,
    };
  }

  return null;
}

function getMemberRoleLabel(member: MemberDto) {
  return member.customRole?.name ?? member.role;
}

export function MembersPage() {
  const { data: auth } = useMe();

  const { data: members = [], isPending, isError } = useMembers();

  const { data: roles = [], isPending: rolesPending } = useRoles();

  const updateMemberRole = useUpdateMemberRole();

  /*
   * Temporary 8.6G authorization.
   *
   * Replace this role check with
   * hasPermission(auth, "members.manage")
   * in 8.6H.
   */
  const canManageRoles = auth?.workspace.role === "owner" || auth?.workspace.role === "admin";

  const customRoles = roles.filter((role) => role.kind === "custom");

  const builtInRoles: WorkspaceRole[] = auth?.workspace.role === "owner" ? ["owner", "admin", "member"] : ["admin", "member"];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Members</h1>

          <p className="mt-1 text-sm text-muted-foreground">People with access to {auth?.workspace.name ?? "this workspace"}.</p>
        </div>

        {isPending ? <p className="text-sm text-muted-foreground">Loading members…</p> : null}

        {isError ? <p className="text-sm text-destructive">Unable to load members.</p> : null}

        {updateMemberRole.isError ? <p className="text-sm text-destructive">{updateMemberRole.error.message}</p> : null}

        {members.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {members.map((member) => {
              const roleValue = getMemberRoleValue(member);

              const changingThisMember = updateMemberRole.isPending && updateMemberRole.variables?.userId === member.id;

              /*
               * Admin must never get a
               * control that appears to
               * allow changing an Owner.
               *
               * Backend remains the real
               * security boundary.
               */
              const canChangeThisMember = canManageRoles && !(auth?.workspace.role === "admin" && member.role === "owner");

              return (
                <div key={member.id} className="flex items-center gap-4 px-4 py-3">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="" className="size-8 shrink-0 rounded-full" />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{member.displayName.charAt(0).toUpperCase()}</div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.displayName}</p>

                    <p className="mt-0.5 text-xs text-muted-foreground">{member.customRole ? "Custom role" : "Built-in role"}</p>
                  </div>

                  {canChangeThisMember ? (
                    <select
                      aria-label={`Role for ${member.displayName}`}
                      value={roleValue}
                      disabled={changingThisMember || rolesPending}
                      onChange={(event) => {
                        const input = parseRoleValue(event.target.value);

                        if (!input) {
                          return;
                        }

                        updateMemberRole.mutate({
                          userId: member.id,

                          input,
                        });
                      }}
                      className="h-9 w-48 rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <optgroup label="Built-in roles">
                        {builtInRoles.map((role) => (
                          <option key={role} value={`builtin:${role}`}>
                            {role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member"}
                          </option>
                        ))}
                      </optgroup>

                      {customRoles.length > 0 && (
                        <optgroup label="Custom roles">
                          {customRoles.map((role) => (
                            <option key={role.id} value={`custom:${role.id}`}>
                              {role.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  ) : (
                    <div className="w-48 text-right">
                      <p className="text-sm capitalize">{getMemberRoleLabel(member)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
