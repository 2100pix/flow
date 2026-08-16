import { useMe } from "@/features/auth/hooks/use-me";
import { useMembers } from "@/features/members/hooks/use-members";
import { useUpdateMemberRole } from "@/features/members/hooks/use-update-member-role";
import { Button } from "@/components/ui/button";
import { useMemberAccessRequests } from "@/features/members/hooks/use-member-access-requests";
import { useApproveMemberAccessRequest } from "@/features/members/hooks/use-approve-member-access-request";
import { useRejectMemberAccessRequest } from "@/features/members/hooks/use-reject-member-access-request";

import type { MemberDto, UpdateWorkspaceMemberRoleInput, WorkspaceRole } from "@/features/members/types";
import { useRoles } from "@/features/roles/hooks/use-roles";
import { hasPermission } from "@/features/auth/permissions";

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
  const canViewMembers = hasPermission(auth, "members.view");
  const canManageMembers = hasPermission(auth, "members.manage");
  const { data: accessRequests = [], isPending: accessRequestsPending, isError: accessRequestsError } = useMemberAccessRequests(canManageMembers);

  const approveAccess = useApproveMemberAccessRequest();
  const rejectAccess = useRejectMemberAccessRequest();
  const canViewRoles = hasPermission(auth, "roles.view");
  const { data: members = [], isPending, isError } = useMembers(canViewMembers);
  const { data: roles = [], isPending: rolesPending } = useRoles(canManageMembers && canViewRoles);
  const updateMemberRole = useUpdateMemberRole();
  const customRoles = roles.filter((role) => role.kind === "custom");
  const builtInRoles: WorkspaceRole[] = auth?.workspace.role === "owner" ? ["owner", "admin", "member"] : auth?.workspace.role === "admin" ? ["admin", "member"] : ["member"];

  if (auth && !canViewMembers) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">You do not have access to workspace members.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Members</h1>

          <p className="mt-1 text-sm text-muted-foreground">People with access to {auth?.workspace.name ?? "this workspace"}.</p>
        </div>
        {canManageMembers ? (
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold">Pending Access</h2>
              <p className="mt-1 text-sm text-muted-foreground">People waiting for workspace access.</p>
            </div>

            {accessRequestsPending ? <p className="text-sm text-muted-foreground">Loading access requests…</p> : null}

            {accessRequestsError ? <p className="text-sm text-destructive">Unable to load access requests.</p> : null}

            {approveAccess.isError ? <p className="text-sm text-destructive">{approveAccess.error.message}</p> : null}

            {rejectAccess.isError ? <p className="text-sm text-destructive">{rejectAccess.error.message}</p> : null}

            {accessRequests.length > 0 ? (
              <div className="divide-y rounded-lg border">
                {accessRequests.map((request) => {
                  const processing = (approveAccess.isPending && approveAccess.variables === request.id) || (rejectAccess.isPending && rejectAccess.variables === request.id);

                  return (
                    <div key={request.id} className="flex items-center gap-4 px-4 py-3">
                      {request.avatarUrl ? (
                        <img src={request.avatarUrl} alt="" className="size-8 shrink-0 rounded-full" />
                      ) : (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{request.displayName.charAt(0).toUpperCase()}</div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{request.displayName}</p>

                        <p className="mt-0.5 text-xs text-muted-foreground">Waiting for access</p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processing}
                          onClick={() => {
                            rejectAccess.mutate(request.id);
                          }}
                        >
                          Reject
                        </Button>

                        <Button
                          size="sm"
                          disabled={processing}
                          onClick={() => {
                            approveAccess.mutate(request.id);
                          }}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !accessRequestsPending && !accessRequestsError ? (
              <p className="text-sm text-muted-foreground">No pending access requests.</p>
            ) : null}
          </div>
        ) : null}
        {isPending ? <p className="text-sm text-muted-foreground">Loading members…</p> : null}

        {isError ? <p className="text-sm text-destructive">Unable to load members.</p> : null}

        {updateMemberRole.isError ? <p className="text-sm text-destructive">{updateMemberRole.error.message}</p> : null}

        {members.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {members.map((member) => {
              const roleValue = getMemberRoleValue(member);
              const changingThisMember = updateMemberRole.isPending && updateMemberRole.variables?.userId === member.id;
              const isSystemOwner = auth?.workspace.role === "owner";
              const isSystemAdmin = auth?.workspace.role === "admin";
              const canChangeThisMember = canManageMembers && (isSystemOwner || (isSystemAdmin && member.role !== "owner") || (!isSystemOwner && !isSystemAdmin && member.role === "member"));

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
