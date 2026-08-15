import { useState } from "react";
import { PencilSimpleIcon, PlusIcon, TrashIcon, XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";
import { useMembers } from "@/features/members/hooks/use-members";
import { useAddTeamMember, useCreateTeam, useDeleteTeam, useRemoveTeamMember, useUpdateTeam } from "@/features/teams/hooks/use-team-mutations";
import { useTeams } from "@/features/teams/hooks/use-teams";
import type { TeamDto } from "@/features/teams/types";

function TeamCard({ team, canManage }: { team: TeamDto; canManage: boolean }) {
  const { data: members = [] } = useMembers();

  const updateTeam = useUpdateTeam();

  const deleteTeam = useDeleteTeam();

  const addMember = useAddTeamMember();

  const removeMember = useRemoveTeamMember();

  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(team.name);

  const [selectedUserId, setSelectedUserId] = useState("");

  const assignedIds = new Set(team.members.map((member) => member.user.id));

  const availableMembers = members.filter((member) => !assignedIds.has(member.id));

  const mutationError = updateTeam.error ?? deleteTeam.error ?? addMember.error ?? removeMember.error;

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex max-w-md gap-2"
              onSubmit={(event) => {
                event.preventDefault();

                const value = name.trim();

                if (!value) {
                  return;
                }

                updateTeam.mutate(
                  {
                    teamId: team.id,
                    name: value,
                  },
                  {
                    onSuccess: () => {
                      setEditing(false);
                    },
                  },
                );
              }}
            >
              <input
                value={name}
                maxLength={120}
                autoFocus
                onChange={(event) => {
                  setName(event.target.value);
                }}
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />

              <Button type="submit" size="sm" disabled={!name.trim() || updateTeam.isPending}>
                Save
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Cancel editing"
                onClick={() => {
                  setName(team.name);

                  setEditing(false);
                }}
              >
                <XIcon />
              </Button>
            </form>
          ) : (
            <>
              <p className="truncate text-sm font-semibold">{team.name}</p>

              <p className="mt-1 text-xs text-muted-foreground">
                {team.members.length} {team.members.length === 1 ? "member" : "members"}
              </p>
            </>
          )}
        </div>

        {canManage && !editing && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${team.name}`}
              title="Edit team"
              onClick={() => {
                setName(team.name);
                setEditing(true);
              }}
            >
              <PencilSimpleIcon />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${team.name}`}
              title="Delete team"
              disabled={deleteTeam.isPending}
              onClick={() => {
                if (!window.confirm(`Delete team "${team.name}"?`)) {
                  return;
                }

                deleteTeam.mutate(team.id);
              }}
            >
              <TrashIcon />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {team.members.length === 0 && <p className="text-sm text-muted-foreground">No members assigned.</p>}

        {team.members.map((member) => (
          <div key={member.user.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
            {member.user.avatarUrl ? (
              <img src={member.user.avatarUrl} alt="" className="size-7 rounded-full" />
            ) : (
              <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium">{member.user.displayName.charAt(0).toUpperCase()}</div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{member.user.displayName}</p>

              <p className="text-xs capitalize text-muted-foreground">{member.user.role}</p>
            </div>

            {canManage && (
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
                <XIcon />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canManage && availableMembers.length > 0 && (
        <div className="mt-4 flex max-w-md gap-2">
          <select
            value={selectedUserId}
            onChange={(event) => {
              setSelectedUserId(event.target.value);
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
          >
            <option value="">Add member…</option>

            {availableMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>

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
      )}

      {mutationError && <p className="mt-3 text-sm text-destructive">{mutationError.message}</p>}
    </div>
  );
}

export function TeamsSettings() {
  const { data: auth } = useMe();

  const { data: teams = [], isPending, isError } = useTeams();

  const createTeam = useCreateTeam();

  const [name, setName] = useState("");

  const canManage = auth?.workspace.role === "owner" || auth?.workspace.role === "admin";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Teams</h2>

        <p className="mt-1 text-sm text-muted-foreground">Group workspace members by discipline or function.</p>
      </div>

      {canManage && (
        <form
          className="flex max-w-md gap-2"
          onSubmit={(event) => {
            event.preventDefault();

            const value = name.trim();

            if (!value) {
              return;
            }

            createTeam.mutate(
              {
                name: value,
              },
              {
                onSuccess: () => {
                  setName("");
                },
              },
            );
          }}
        >
          <input
            value={name}
            maxLength={120}
            placeholder="Design"
            onChange={(event) => {
              setName(event.target.value);
            }}
            className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />

          <Button type="submit" disabled={!name.trim() || createTeam.isPending}>
            <PlusIcon />

            {createTeam.isPending ? "Creating…" : "Create team"}
          </Button>
        </form>
      )}

      {createTeam.isError && <p className="text-sm text-destructive">{createTeam.error.message}</p>}

      {isPending && <p className="text-sm text-muted-foreground">Loading teams…</p>}

      {isError && <p className="text-sm text-destructive">Unable to load teams.</p>}

      {!isPending && !isError && teams.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8">
          <p className="text-sm font-medium">No teams yet</p>

          <p className="mt-1 text-sm text-muted-foreground">Create teams such as Design, Development, or Production.</p>
        </div>
      )}

      <div className="space-y-4">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} canManage={canManage} />
        ))}
      </div>
    </section>
  );
}
