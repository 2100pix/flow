import { useMemo, useState } from "react";
import { DotsThreeIcon, MagnifyingGlassIcon, CheckIcon, PlusIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

import { useRoles } from "@/features/roles/hooks/use-roles";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/hooks/use-me";
import { useApproveMemberAccessRequest } from "@/features/members/hooks/use-approve-member-access-request";
import { useMemberAccessRequests } from "@/features/members/hooks/use-member-access-requests";
import { useMembers } from "@/features/members/hooks/use-members";
import { useRejectMemberAccessRequest } from "@/features/members/hooks/use-reject-member-access-request";
import { useUpdateMemberRole } from "@/features/members/hooks/use-update-member-role";
import { useAddTeamMember, useRemoveTeamMember } from "@/features/teams/hooks/use-team-mutations";
import { useRemoveWorkspaceMember } from "@/features/members/hooks/use-workspace-member-mutations";
import { useTeams } from "@/features/teams/hooks/use-teams";
import { useCreateWorkspaceExpertise, useUpdateMemberExpertise, useWorkspaceExpertise } from "@/features/members/hooks/use-workspace-expertise";
import { resolvePersonName } from "@/lib/person-name";

import type { MemberAccessRequestDto, MemberDto } from "@/features/members/types";
import type { TeamDto } from "@/features/teams/types";

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function getMemberLabel(member: Pick<MemberDto, "firstName" | "lastName" | "displayName">) {
  return resolvePersonName({
    firstName: member.firstName,

    lastName: member.lastName,

    displayName: member.displayName,
  });
}

function formatJoinedAt(value: string | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",

    month: "2-digit",

    year: "numeric",
  }).format(date);
}

function getRoleLabel(member: MemberDto) {
  if (member.customRole) {
    return member.customRole.name;
  }

  if (member.role === "owner") {
    return "Owner";
  }

  if (member.role === "admin") {
    return "Admin";
  }

  return "Member";
}

function haveSameIds(first: readonly string[], second: readonly string[]) {
  if (first.length !== second.length) {
    return false;
  }

  const secondSet = new Set(second);

  return first.every((id) => secondSet.has(id));
}

function getMemberRoleId(member: MemberDto) {
  if (member.role === "owner") {
    return "builtin:owner";
  }

  if (member.role === "admin") {
    return "builtin:admin";
  }

  if (member.customRole) {
    return member.customRole.id;
  }

  return "builtin:member";
}

function getMemberRoleRank(member: MemberDto, roleOrder: ReadonlyMap<string, number>) {
  return roleOrder.get(getMemberRoleId(member)) ?? Number.MAX_SAFE_INTEGER;
}

function PendingMembersDialog({
  open,
  onOpenChange,
  requests,
}: {
  open: boolean;

  onOpenChange: (open: boolean) => void;

  requests: MemberAccessRequestDto[];
}) {
  const approve = useApproveMemberAccessRequest();

  const reject = useRejectMemberAccessRequest();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] max-w-[calc(100vw-2rem)]! sm:max-w-[420px]!">
        <DialogHeader>
          <DialogTitle>Pending</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-1">
          {requests.map((request) => (
            <div key={request.id} className="flex min-h-11 items-center gap-3">
              <Avatar size="sm" aria-hidden="true">
                {request.avatarUrl ? <AvatarImage src={request.avatarUrl} alt="" /> : null}

                <AvatarFallback>{getInitials(getMemberLabel(request))}</AvatarFallback>
              </Avatar>

              <p className="min-w-0 flex-1 truncate text-sm">{getMemberLabel(request)}</p>

              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={approve.isPending || reject.isPending}
                onClick={() => {
                  approve.mutate(request.id, {
                    onSuccess: () => {
                      toast.success("Member accepted.");
                    },
                  });
                }}
              >
                Accept
              </Button>

              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={approve.isPending || reject.isPending}
                onClick={() => {
                  reject.mutate(request.id, {
                    onSuccess: () => {
                      toast.success("Request rejected.");
                    },
                  });
                }}
              >
                Reject
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ member, teams, open, onOpenChange }: { member: MemberDto; teams: TeamDto[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const updateRole = useUpdateMemberRole();
  const updateExpertise = useUpdateMemberExpertise();
  const createExpertise = useCreateWorkspaceExpertise();
  const addTeamMember = useAddTeamMember();
  const removeTeamMember = useRemoveTeamMember();
  const { data: roles = [] } = useRoles();
  const { data: auth } = useMe();
  const availableRoles = roles.filter((role) => role.systemKey !== "owner" || auth?.workspace.isCreator || member.role === "owner");
  const { data: expertise = [] } = useWorkspaceExpertise();
  const initialRoleValue = member.customRole ? `custom:${member.customRole.id}` : `built_in:${member.role}`;
  const initialTeamIds = teams.filter((team) => team.members.some((teamMember) => teamMember.user.id === member.id)).map((team) => team.id);
  const initialExpertiseIds = (member.expertise ?? []).map((item) => item.id);
  const [roleValue, setRoleValue] = useState(() => initialRoleValue);
  const [teamIds, setTeamIds] = useState<string[]>(() => initialTeamIds);
  const [expertiseIds, setExpertiseIds] = useState<string[]>(() => initialExpertiseIds);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [creatingExpertise, setCreatingExpertise] = useState(false);
  const [expertiseName, setExpertiseName] = useState("");

  function createNewExpertise() {
    const name = expertiseName.trim();

    if (!name || createExpertise.isPending) {
      if (!name) {
        setCreatingExpertise(false);
      }

      return;
    }

    createExpertise.mutate(
      {
        name,
      },
      {
        onSuccess: (created) => {
          setExpertiseIds((current) => (current.includes(created.id) ? current : [...current, created.id]));

          setExpertiseName("");

          setCreatingExpertise(false);
        },

        onError: () => {},
      },
    );
  }
  const roleChanged = roleValue !== initialRoleValue;

  const teamChanged = !haveSameIds(teamIds, initialTeamIds);

  const expertiseChanged = !haveSameIds(expertiseIds, initialExpertiseIds);

  const teamIdsToAdd = teamIds.filter((teamId) => !initialTeamIds.includes(teamId));

  const teamIdsToRemove = initialTeamIds.filter((teamId) => !teamIds.includes(teamId));

  const hasChanges = roleChanged || teamChanged || expertiseChanged;

  const isSaving = updateRole.isPending || updateExpertise.isPending || addTeamMember.isPending || removeTeamMember.isPending;

  async function saveMember() {
    if (!hasChanges || isSaving) {
      return;
    }

    try {
      const operations: Promise<unknown>[] = [];

      if (roleChanged) {
        if (roleValue.startsWith("custom:")) {
          operations.push(
            updateRole.mutateAsync({
              userId: member.id,

              input: {
                kind: "custom",

                roleId: roleValue.slice("custom:".length),
              },
            }),
          );
        } else {
          const role = roleValue.slice("built_in:".length);

          if (role !== "owner" && role !== "admin" && role !== "member") {
            throw new Error("Invalid member role.");
          }

          operations.push(
            updateRole.mutateAsync({
              userId: member.id,

              input: {
                kind: "built_in",

                role,
              },
            }),
          );
        }
      }

      if (expertiseChanged) {
        operations.push(
          updateExpertise.mutateAsync({
            userId: member.id,

            expertiseIds,
          }),
        );
      }

      for (const teamId of teamIdsToAdd) {
        operations.push(
          addTeamMember.mutateAsync({
            teamId,

            userId: member.id,
          }),
        );
      }

      for (const teamId of teamIdsToRemove) {
        operations.push(
          removeTeamMember.mutateAsync({
            teamId,

            userId: member.id,
          }),
        );
      }

      await Promise.all(operations);

      toast.success("Member updated.");

      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Failed to update member.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-[450px]
          max-w-[calc(100vw-2rem)]!
          sm:max-w-[450px]!
          gap-8
          rounded-[10px]
          p-6
        "
      >
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <label htmlFor="edit-member-display-name" className="text-sm text-muted-foreground">
              Display Name
            </label>

            <input
              id="edit-member-display-name"
              value={getMemberLabel(member)}
              readOnly
              disabled
              title="Synced from Discord and personal profile settings"
              className="
                mt-3 h-9 w-full
                rounded-lg border
                border-input
                bg-muted
                px-3 text-sm
                text-muted-foreground
                outline-none
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            />

            <p className="mt-1.5 text-[11px] text-muted-foreground">Synced from Discord &amp; profile settings.</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Role</p>

            <Select
              value={roleValue}
              disabled={isSaving}
              onValueChange={(value) => {
                setRoleValue(String(value));
              }}
            >
              <SelectTrigger className="mt-3 h-8 w-auto min-w-32 rounded-lg px-2.5 text-xs">
                {availableRoles.find((role) => {
                  if (role.kind === "built_in") {
                    return roleValue === `built_in:${role.systemKey}`;
                  }

                  return roleValue === `custom:${role.id}`;
                })?.name ?? "Role"}
              </SelectTrigger>

              <SelectContent align="start" alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectLabel>Role</SelectLabel>

                  <SelectSeparator />

                  {availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.kind === "built_in" ? `built_in:${role.systemKey}` : `custom:${role.id}`}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Team</p>

            <Popover open={teamPickerOpen} onOpenChange={setTeamPickerOpen}>
              <PopoverTrigger render={<Button type="button" variant="outline" disabled={isSaving} className="mt-3 h-8 w-auto min-w-32 justify-start rounded-lg px-2.5 text-xs font-normal" />}>
                {teamIds.length === 0 ? "No team" : teamIds.length === 1 ? (teams.find((team) => team.id === teamIds[0])?.name ?? "1 team") : `${teamIds.length} teams`}
              </PopoverTrigger>

              <PopoverContent align="start" className="w-56 p-0">
                <div className="p-1">
                  <div className="px-1.5 py-1 text-xs text-muted-foreground">Teams</div>

                  <div className="-mx-1 my-1 h-px bg-border" />

                  {teams.map((team) => {
                    const selected = teamIds.includes(team.id);

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          setTeamIds(selected ? teamIds.filter((id) => id !== team.id) : [...teamIds, team.id]);
                        }}
                        className="
                            relative
                            flex h-8 w-full
                            items-center
                            rounded-md
                            py-1 pr-8 pl-1.5
                            text-left text-sm
                            outline-none
                            hover:bg-foreground/10
                            focus-visible:bg-foreground/10
                          "
                      >
                        <span className="min-w-0 flex-1 truncate">{team.name}</span>

                        {selected ? <CheckIcon className="absolute right-2 size-4" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Expertise</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {expertise.map((item) => {
                const selected = expertiseIds.includes(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setExpertiseIds(selected ? expertiseIds.filter((id) => id !== item.id) : [...expertiseIds, item.id]);
                    }}
                    className="
                        inline-flex h-7
                        items-center gap-1.5
                        rounded-full
                        border border-border
                        px-2.5 text-xs
                        transition-colors
                        hover:bg-muted
                        disabled:opacity-50
                      "
                  >
                    {item.name}

                    {selected ? <CheckIcon className="size-3.5" aria-hidden="true" /> : null}
                  </button>
                );
              })}

              {creatingExpertise ? (
                <form
                  className="inline-flex"
                  onSubmit={(event) => {
                    event.preventDefault();

                    createNewExpertise();
                  }}
                >
                  <input
                    autoFocus
                    value={expertiseName}
                    maxLength={80}
                    placeholder="Create new"
                    disabled={createExpertise.isPending}
                    onChange={(event) => {
                      setExpertiseName(event.target.value);
                    }}
                    onBlur={() => {
                      createNewExpertise();
                    }}
                    className="
                    h-7
                    w-auto
                    min-w-[92px]
                    max-w-[220px]
                    [field-sizing:content]
                    rounded-full
                    border border-input
                    bg-background
                    px-2.5
                    text-xs
                    outline-none
                    placeholder:text-muted-foreground
                    focus-visible:border-ring
                    focus-visible:ring-2
                    focus-visible:ring-ring/40
                    disabled:opacity-50
                  "
                  />
                </form>
              ) : (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => {
                    setCreatingExpertise(true);
                  }}
                  className="
                    inline-flex h-7
                    items-center gap-1
                    rounded-full
                    border border-border
                    px-2.5 text-xs
                    text-muted-foreground
                    transition-colors
                    hover:bg-muted
                    hover:text-foreground
                  "
                >
                  <PlusIcon className="size-3.5" aria-hidden="true" />
                  Create new
                </button>
              )}
            </div>

            {createExpertise.isError ? <p className="mt-2 text-xs text-destructive">{createExpertise.error.message}</p> : null}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={!hasChanges || isSaving}
            onClick={() => {
              void saveMember();
            }}
          >
            {isSaving ? "Saving…" : "Save member"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  member,
  teams,
  teamNames,
  canManage,
  currentUserId,
  currentWorkspaceRole,
}: {
  member: MemberDto;
  teams: TeamDto[];

  teamNames: string[];

  canManage: boolean;

  currentUserId: string;

  currentWorkspaceRole: "owner" | "admin" | "member";
}) {
  const updateRole = useUpdateMemberRole();

  const removeMember = useRemoveWorkspaceMember();

  const [editOpen, setEditOpen] = useState(false);

  const [removeOpen, setRemoveOpen] = useState(false);

  const canChangeBuiltInRole = canManage && member.role !== "owner";

  const nextBuiltInRole = member.role === "admin" ? "member" : "admin";

  const nextBuiltInRoleLabel = member.role === "admin" ? "Set member" : "Set admin";

  const canRemove = canManage && member.id !== currentUserId && (member.role !== "owner" || currentWorkspaceRole === "owner");
  return (
    <>
      <div
        className="
          group/member
          grid min-h-12
grid-cols-[minmax(260px,1fr)_32px_170px_120px_200px_72px]
          items-center
          border-b border-border/60
          text-sm
        "
      >
        <div className="flex min-w-0 items-center gap-2.5 pr-4">
          <Avatar size="sm" aria-hidden="true">
            {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}

            <AvatarFallback>{getInitials(getMemberLabel(member))}</AvatarFallback>
          </Avatar>

          <span className="min-w-0 truncate">{getMemberLabel(member)}</span>

          {member.role === "owner" ? (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Owner
            </Badge>
          ) : member.role === "admin" ? (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Admin
            </Badge>
          ) : null}
        </div>

        <div className="flex justify-center">
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${getMemberLabel(member)}`}
                    className="
                      opacity-0
                      transition-opacity
                      group-hover/member:opacity-100
                      group-focus-within/member:opacity-100
                    "
                  />
                }
              >
                <DotsThreeIcon weight="bold" aria-hidden="true" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-40">
                <DropdownMenuItem
                  onClick={() => {
                    setEditOpen(true);
                  }}
                >
                  Edit member
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={!canChangeBuiltInRole || updateRole.isPending}
                  onClick={() => {
                    updateRole.mutate(
                      {
                        userId: member.id,

                        input: {
                          kind: "built_in",

                          role: nextBuiltInRole,
                        },
                      },
                      {
                        onSuccess: () => {
                          toast.success(nextBuiltInRole === "admin" ? "Member set as admin." : "Admin set as member.");
                        },

                        onError: (error) => {
                          toast.error(error instanceof Error && error.message ? error.message : "Failed to update member role.");
                        },
                      },
                    );
                  }}
                >
                  {nextBuiltInRoleLabel}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  disabled={!canRemove}
                  onClick={() => {
                    setRemoveOpen(true);
                  }}
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-1.5 overflow-visible">
          {(member.expertise?.length ?? 0) === 0 ? null : (
            <>
              <Badge variant="outline" className="max-w-36 shrink-0 truncate font-normal">
                {member.expertise?.[0]?.name}
              </Badge>

              {(member.expertise?.length ?? 0) > 1 ? (
                <HoverCard>
                  <HoverCardTrigger
                    render={
                      <Badge
                        variant="outline"
                        className="
                        shrink-0
                        cursor-default
                        text-[10px]
                        font-normal
                      "
                      />
                    }
                  >
                    +{(member.expertise?.length ?? 1) - 1}
                  </HoverCardTrigger>

                  <HoverCardContent align="start" side="top" className="w-auto max-w-72 p-2">
                    <div className="flex max-w-64 flex-wrap gap-1.5">
                      {member.expertise?.slice(1).map((expertise) => (
                        <Badge key={expertise.id} variant="outline" className="font-normal">
                          {expertise.name}
                        </Badge>
                      ))}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ) : null}
            </>
          )}
        </div>
        <p className="truncate text-muted-foreground">{getRoleLabel(member)}</p>

        <div className="min-w-0">
          {teamNames.length === 0 ? null : (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate">{teamNames[0]}</span>

              {teamNames.length > 1 ? (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  +{teamNames.length - 1}
                </Badge>
              ) : null}
            </div>
          )}
        </div>

        <p className="text-muted-foreground">{formatJoinedAt(member.joinedAt)}</p>
      </div>
      {editOpen ? <EditMemberDialog key={member.id} member={member} teams={teams} open onOpenChange={setEditOpen} /> : null}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>

            <AlertDialogDescription>{getMemberLabel(member)} will be removed from this workspace, its projects, teams and task assignments. The Flow user account itself will not be deleted.</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>Cancel</AlertDialogCancel>

            <AlertDialogAction
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={() => {
                removeMember.mutate(member.id, {
                  onSuccess: () => {
                    toast.success("Member removed.");

                    setRemoveOpen(false);
                  },

                  onError: (error) => {
                    toast.error(error instanceof Error && error.message ? error.message : "Failed to remove member.");
                  },
                });
              }}
            >
              {removeMember.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MembersSettings() {
  const { data: auth } = useMe();

  const { data: members = [], isPending, isError } = useMembers();
  const { data: roles = [] } = useRoles();

  const { data: teams = [] } = useTeams();

  const canManage = hasPermission(auth, "members.manage");

  const { data: pending = [] } = useMemberAccessRequests(canManage);

  const [query, setQuery] = useState("");

  const [pendingOpen, setPendingOpen] = useState(false);

  const teamsByUserId = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const team of teams) {
      for (const member of team.members) {
        const existing = map.get(member.user.id) ?? [];

        existing.push(team.name);

        map.set(member.user.id, existing);
      }
    }

    return map;
  }, [teams]);

  const normalizedQuery = query.trim().toLowerCase();

  const roleOrder = useMemo(() => {
    const map = new Map<string, number>();

    roles.forEach((role, index) => {
      map.set(role.id, index);
    });

    return map;
  }, [roles]);

  const filteredMembers = useMemo(() => {
    const filtered = normalizedQuery
      ? members.filter((member) => {
          const teamNames = teamsByUserId.get(member.id) ?? [];

          const expertiseNames = (member.expertise ?? []).map((item) => item.name);

          return [getMemberLabel(member), getRoleLabel(member), ...teamNames, ...expertiseNames].some((value) => value.toLowerCase().includes(normalizedQuery));
        })
      : [...members];

    return filtered.sort((first, second) => {
      const roleDifference = getMemberRoleRank(first, roleOrder) - getMemberRoleRank(second, roleOrder);

      if (roleDifference !== 0) {
        return roleDifference;
      }

      return getMemberLabel(first).localeCompare(getMemberLabel(second));
    });
  }, [members, normalizedQuery, teamsByUserId, roleOrder]);

  if (!auth) {
    return null;
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Members</h1>

      <div className="mt-8">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <div className="relative w-full max-w-xs">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />

            <input
              value={query}
              placeholder="Filter by name"
              aria-label="Filter members by name"
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

          <div className="flex items-center gap-2">
            {canManage ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending.length === 0}
                onClick={() => {
                  setPendingOpen(true);
                }}
              >
                Pending
                {pending.length > 0 ? (
                  <Badge variant="destructive" className="ml-1 min-w-5 justify-center px-1 text-[10px]">
                    {pending.length}
                  </Badge>
                ) : null}
              </Button>
            ) : null}

            {canManage ? (
              <Button type="button" variant="secondary" size="sm" disabled title="Coming soon">
                <PlusIcon aria-hidden="true" />
                Invite member
              </Button>
            ) : null}
          </div>
        </div>

        {isPending ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading members…</div>
        ) : isError ? (
          <div className="py-20 text-center text-sm text-destructive">Unable to load members.</div>
        ) : (
          <div className="mt-6">
            <div
              className="
                grid h-8
grid-cols-[minmax(260px,1fr)_32px_170px_120px_200px_72px]                items-center
                border-b border-border
                text-[11px]
                text-muted-foreground
              "
            >
              <span>Name</span>

              <span />

              <span>Expertise</span>

              <span>Role</span>

              <span>Team</span>

              <span>Joined</span>
            </div>

            {filteredMembers.map((member) => (
              <MemberRow key={member.id} member={member} teams={teams} teamNames={teamsByUserId.get(member.id) ?? []} canManage={canManage} currentUserId={auth.user.id} currentWorkspaceRole={auth.workspace.role} />
            ))}
          </div>
        )}
      </div>

      <PendingMembersDialog open={pendingOpen} onOpenChange={setPendingOpen} requests={pending} />
    </div>
  );
}
