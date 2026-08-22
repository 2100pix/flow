import { useMemo, useState } from "react";
import { CheckIcon, DotsThreeIcon, MagnifyingGlassIcon, PlusIcon, UsersThreeIcon, XIcon } from "@phosphor-icons/react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/hooks/use-me";
import { useMembers } from "@/features/members/hooks/use-members";
import { useAddTeamMember, useCreateTeam, useDeleteTeam, useRemoveTeamMember, useUpdateTeam } from "@/features/teams/hooks/use-team-mutations";
import { useTeams } from "@/features/teams/hooks/use-teams";

import type { TeamDto } from "@/features/teams/types";

function getInitials(displayName: string) {
  return (
    displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function CreateTeamDialog({
  open,
  onClose,
}: {
  open: boolean;

  onClose: () => void;
}) {
  const createTeam = useCreateTeam();

  const [name, setName] = useState("");

  function reset() {
    setName("");

    createTeam.reset();
  }

  function close() {
    if (createTeam.isPending) {
      return;
    }

    reset();

    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
    >
      <DialogContent
        showCloseButton={!createTeam.isPending}
        className="
          w-[420px]
          max-w-[calc(100vw-2rem)]!
          sm:max-w-[420px]!
          gap-6
          rounded-[10px]
          p-6
          shadow-lg
          [&>[data-slot=dialog-close]]:right-[18px]
          [&>[data-slot=dialog-close]]:top-6
          [&>[data-slot=dialog-close]]:size-7
          [&>[data-slot=dialog-close]]:bg-transparent
          [&>[data-slot=dialog-close]>svg]:opacity-70
        "
      >
        <DialogHeader className="gap-0 p-0">
          <DialogTitle className="pr-10 text-lg font-semibold leading-7">Create team</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-8"
          onSubmit={(event) => {
            event.preventDefault();

            const value = name.trim();

            if (!value || createTeam.isPending) {
              return;
            }

            createTeam.mutate(
              {
                name: value,
              },
              {
                onSuccess: () => {
                  reset();

                  onClose();
                },
              },
            );
          }}
        >
          <div>
            <label htmlFor="create-team-name" className="sr-only">
              Team name
            </label>

            <input
              id="create-team-name"
              value={name}
              maxLength={120}
              autoFocus
              disabled={createTeam.isPending}
              placeholder="Team name"
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="
                h-[35px]
                w-full
                rounded-none
                border-0
                bg-transparent
                px-0
                py-1
                text-base
                font-medium
                shadow-none
                outline-none
                ring-0
                placeholder:font-medium
                placeholder:text-muted-foreground
                focus:border-transparent
                focus:outline-none
                focus:ring-0
                focus-visible:border-transparent
                focus-visible:outline-none
                focus-visible:ring-0
                disabled:opacity-50
              "
            />

            {createTeam.isError ? <p className="mt-2 text-xs text-destructive">{createTeam.error.message}</p> : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="lg" className="border border-border px-4 shadow-xs" disabled={createTeam.isPending} onClick={close}>
              Cancel
            </Button>

            <Button type="submit" size="lg" className="px-4 shadow-xs" disabled={!name.trim() || createTeam.isPending}>
              {createTeam.isPending ? "Creating…" : "Create team"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageTeamDialog({
  team,
  open,
  onOpenChange,
}: {
  team: TeamDto;

  open: boolean;

  onOpenChange: (open: boolean) => void;
}) {
  const { data: members = [] } = useMembers();

  const updateTeam = useUpdateTeam();

  const addMember = useAddTeamMember();

  const removeMember = useRemoveTeamMember();

  const [name, setName] = useState(() => team.name);

  const [memberPickerOpen, setMemberPickerOpen] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState("");

  const assignedIds = useMemo(() => new Set(team.members.map((member) => member.user.id)), [team.members]);

  const availableMembers = members.filter((member) => !assignedIds.has(member.id));

  const selectedMember = availableMembers.find((member) => member.id === selectedUserId) ?? null;

  const normalizedName = name.trim();

  const nameChanged = normalizedName !== team.name && Boolean(normalizedName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage team</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Team name</p>

            <div className="flex gap-2">
              <input
                value={name}
                maxLength={120}
                disabled={updateTeam.isPending}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                className="
                  h-8 min-w-0 flex-1
                  rounded-lg border
                  border-input
                  bg-background
                  px-2.5 text-sm
                  outline-none
                  focus-visible:border-ring
                  focus-visible:ring-3
                  focus-visible:ring-ring/50
                "
              />

              <Button
                type="button"
                size="sm"
                disabled={!nameChanged || updateTeam.isPending}
                onClick={() => {
                  if (!normalizedName) {
                    return;
                  }

                  updateTeam.mutate({
                    teamId: team.id,

                    name: normalizedName,
                  });
                }}
              >
                Save
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Members</p>

            {team.members.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No members assigned.</p>
            ) : (
              <div className="divide-y">
                {team.members.map((member) => (
                  <div key={member.user.id} className="flex items-center gap-3 py-3">
                    <Avatar size="sm" aria-hidden="true">
                      {member.user.avatarUrl ? <AvatarImage src={member.user.avatarUrl} alt="" /> : null}

                      <AvatarFallback>{getInitials(member.user.displayName)}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.user.displayName}</p>

                      <p className="text-xs capitalize text-muted-foreground">{member.user.role}</p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${member.user.displayName}`}
                      title="Remove from team"
                      disabled={removeMember.isPending}
                      onClick={() => {
                        removeMember.mutate({
                          teamId: team.id,

                          userId: member.user.id,
                        });
                      }}
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {availableMembers.length > 0 ? (
              <div className="mt-4 flex gap-2">
                <Popover open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
                  <PopoverTrigger render={<Button type="button" variant="outline" className="h-8 min-w-0 flex-1 justify-between rounded-lg px-2.5 text-xs font-normal" />}>
                    {selectedMember ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Avatar size="sm" className="size-5" aria-hidden="true">
                          {selectedMember.avatarUrl ? <AvatarImage src={selectedMember.avatarUrl} alt="" /> : null}

                          <AvatarFallback className="text-[9px]">{getInitials(selectedMember.displayName)}</AvatarFallback>
                        </Avatar>

                        <span className="truncate">{selectedMember.displayName}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Add member</span>
                    )}
                  </PopoverTrigger>

                  <PopoverContent align="start" className="w-56 p-0">
                    <div className="p-1">
                      <div className="px-1.5 py-1 text-xs text-muted-foreground">Workspace members</div>

                      <div className="-mx-1 my-1 h-px bg-border" />

                      <div className="max-h-64 overflow-y-auto">
                        {availableMembers.map((member) => {
                          const selected = member.id === selectedUserId;

                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => {
                                setSelectedUserId(member.id);

                                setMemberPickerOpen(false);
                              }}
                              className="
                                  relative
                                  flex h-8 w-full
                                  cursor-default
                                  items-center gap-1.5
                                  rounded-md
                                  py-1 pr-8 pl-1.5
                                  text-left text-sm
                                  outline-none
                                  hover:bg-foreground/10
                                  focus-visible:bg-foreground/10
                                "
                            >
                              <Avatar size="sm" className="size-5" aria-hidden="true">
                                {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}

                                <AvatarFallback className="text-[9px]">{getInitials(member.displayName)}</AvatarFallback>
                              </Avatar>

                              <span className="min-w-0 flex-1 truncate">{member.displayName}</span>

                              {selected ? <CheckIcon className="absolute right-2 size-4" aria-hidden="true" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedUserId || addMember.isPending}
                  onClick={() => {
                    if (!selectedUserId) {
                      return;
                    }

                    addMember.mutate(
                      {
                        teamId: team.id,

                        userId: selectedUserId,
                      },
                      {
                        onSuccess: () => {
                          setSelectedUserId("");
                        },
                      },
                    );
                  }}
                >
                  Add
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeamRow({
  team,
  canManage,
}: {
  team: TeamDto;

  canManage: boolean;
}) {
  const deleteTeam = useDeleteTeam();

  const [manageOpen, setManageOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <div
        className="
          group/team
          grid min-h-12
          grid-cols-[minmax(0,1fr)_40px_90px_90px]
          items-center
          border-b border-border/60
          text-sm
        "
      >
        <div className="min-w-0 pr-4">
          <p className="truncate">{team.name}</p>
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
                    aria-label={`Actions for ${team.name}`}
                    className="
                      opacity-0
                      transition-opacity
                      group-hover/team:opacity-100
                      group-focus-within/team:opacity-100
                    "
                  />
                }
              >
                <DotsThreeIcon weight="bold" aria-hidden="true" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setManageOpen(true);
                  }}
                >
                  Manage team
                </DropdownMenuItem>

                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    setDeleteOpen(true);
                  }}
                >
                  Delete team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <p className="text-muted-foreground">{team.members.length}</p>

        <p className="text-muted-foreground">{formatCreatedAt(team.createdAt)}</p>
      </div>

      {manageOpen ? <ManageTeamDialog key={team.id} team={team} open onOpenChange={setManageOpen} /> : null}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>

            <AlertDialogDescription>{team.name} will be permanently deleted. Workspace members themselves will not be deleted.</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTeam.isPending}>Cancel</AlertDialogCancel>

            <AlertDialogAction
              variant="destructive"
              disabled={deleteTeam.isPending}
              onClick={() => {
                deleteTeam.mutate(team.id, {
                  onSuccess: () => {
                    setDeleteOpen(false);
                  },
                });
              }}
            >
              {deleteTeam.isPending ? "Deleting…" : "Delete team"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function TeamsSettings() {
  const { data: auth } = useMe();

  const { data: teams = [], isPending, isError } = useTeams();

  const canManage = hasPermission(auth, "teams.manage");

  const [query, setQuery] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTeams = useMemo(() => (normalizedQuery ? teams.filter((team) => team.name.toLowerCase().includes(normalizedQuery)) : teams), [normalizedQuery, teams]);

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Teams</h1>

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
              aria-label="Filter teams by name"
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
                setCreateDialogOpen(true);
              }}
            >
              <PlusIcon aria-hidden="true" />
              New team
            </Button>
          ) : null}
        </div>

        {isPending ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading teams…</div>
        ) : isError ? (
          <div className="py-20 text-center text-sm text-destructive">Unable to load teams.</div>
        ) : teams.length === 0 ? (
          <Empty className="min-h-[360px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UsersThreeIcon aria-hidden="true" />
              </EmptyMedia>

              <EmptyTitle>No Teams</EmptyTitle>

              <EmptyDescription>Create your team to collaborate on this workspace.</EmptyDescription>
            </EmptyHeader>

            {canManage ? (
              <EmptyContent>
                <Button
                  type="button"
                  onClick={() => {
                    setCreateDialogOpen(true);
                  }}
                >
                  <PlusIcon aria-hidden="true" />
                  New team
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : filteredTeams.length === 0 ? (
          <Empty className="min-h-[280px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MagnifyingGlassIcon aria-hidden="true" />
              </EmptyMedia>

              <EmptyTitle>No matching teams</EmptyTitle>

              <EmptyDescription>No team matches &quot;{query}&quot;.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mt-6">
            <div
              className="
                grid h-8
                grid-cols-[minmax(0,1fr)_40px_90px_90px]
                items-center
                border-b border-border
                text-[11px]
                text-muted-foreground
              "
            >
              <span>Name</span>

              <span />

              <span>Members</span>

              <span>Created</span>
            </div>

            {filteredTeams.map((team) => (
              <TeamRow key={team.id} team={team} canManage={canManage} />
            ))}
          </div>
        )}
      </div>

      <CreateTeamDialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
        }}
      />
    </div>
  );
}
