import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { RolesSettings } from "@/features/roles/components/roles-settings";
import { TeamsSettings } from "@/features/teams/components/teams-settings";
import { MembersSettings } from "@/features/members/components/members-settings";
import { DiscordIntegrationSettings } from "@/features/integrations/discord/components/discord-integration-settings";

import { getErrorMessage } from "@/lib/errors";

import { hasPermission } from "@/features/auth/permissions";
import { useUpdateWorkspace } from "@/features/workspace/hooks/use-update-workspace";
import { PersonalSettings } from "@/features/profile/components/personal-settings";
import { useMe } from "@/features/auth/hooks/use-me";

const settingsSections = [
  {
    id: "personal",
    label: "Personal",
  },
  {
    id: "general",
    label: "General",
  },
  {
    id: "teams",
    label: "Teams",
  },
  {
    id: "members",
    label: "Members",
  },
  {
    id: "roles",
    label: "Roles",
  },
  {
    id: "integrations",
    label: "Integrations",
  },
] as const;

type SettingsSection = (typeof settingsSections)[number]["id"];

function isSettingsSection(value: string | null): value is SettingsSection {
  return settingsSections.some((section) => section.id === value);
}

function GeneralSettings() {
  const { data: auth } = useMe();
  const updateWorkspace = useUpdateWorkspace();
  const [workspaceName, setWorkspaceName] = useState(() => auth?.workspace.name ?? "");

  if (!auth) {
    return null;
  }

  const canManageWorkspace = hasPermission(auth, "workspace.manage");
  const normalizedName = workspaceName.trim();
  const hasNameChange = normalizedName !== auth.workspace.name;
  const workspaceInitial = auth.workspace.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">General</h1>
      <div className="mt-8">
        <div className="mx-auto mt-10 max-w-xl space-y-12">
          <section>
            <p className="text-xs font-medium text-muted-foreground">Workspace</p>
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault();

                if (!canManageWorkspace || !normalizedName || !hasNameChange || updateWorkspace.isPending) {
                  return;
                }

                updateWorkspace.mutate(
                  {
                    name: normalizedName,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Workspace updated.");
                    },

                    onError: (error) => {
                      toast.error(getErrorMessage(error, "Failed to update workspace."));
                    },
                  },
                );
              }}
            >
              <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                <div className="flex min-h-12 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="workspace-name" className="text-xs font-medium">
                    Workspace Name
                  </label>

                  <input
                    id="workspace-name"
                    value={workspaceName}
                    maxLength={120}
                    disabled={!canManageWorkspace || updateWorkspace.isPending}
                    onChange={(event) => {
                      setWorkspaceName(event.target.value);
                    }}
                    className="
                      h-8 w-full
                      rounded-md
                      border border-input
                      bg-background
                      px-2.5
                      text-sm
                      outline-none
                      transition-[border-color,box-shadow]
                      sm:w-52
                      focus-visible:border-ring
                      focus-visible:ring-3
                      focus-visible:ring-ring/50
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  />
                </div>

                <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-xs font-medium">Workspace Logo</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Under development</p>
                  </div>

                  <div
                    aria-label="Workspace logo placeholder"
                    title="Workspace logo - Under development"
                    className="
                      flex size-8 shrink-0
                      items-center justify-center
                      rounded-md
                      border border-border
                      bg-muted
                      text-xs font-semibold
                      text-muted-foreground
                    "
                  >
                    {workspaceInitial}
                  </div>
                </div>
              </div>

              {canManageWorkspace && hasNameChange ? (
                <div className="mt-3 flex justify-end">
                  <Button type="submit" size="sm" disabled={!normalizedName || updateWorkspace.isPending}>
                    {updateWorkspace.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              ) : null}
            </form>
          </section>

          <section>
            <p className="text-xs font-medium text-muted-foreground">Dangerzone</p>

            <div className="mt-3 flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border/60 bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-medium">Delete Workspace</p>
              </div>

              <Button type="button" variant="destructive" size="sm" disabled title="Coming soon" className="shrink-0">
                Delete
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const { data: auth } = useMe();
  const activeSectionValue = searchParams.get("section");
  const requestedSection: SettingsSection = isSettingsSection(activeSectionValue) ? activeSectionValue : "general";

  if (!auth) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      </div>
    );
  }

  const canViewSettings = hasPermission(auth, "settings.view");

  if (requestedSection === "personal") {
    return <PersonalSettings />;
  }

  if (!canViewSettings) {
    return (
      <div className="p-6 md:p-8">
        <p className="text-sm text-muted-foreground">You do not have access to workspace settings.</p>
      </div>
    );
  }

  const activeSection =
    requestedSection === "teams" && !hasPermission(auth, "teams.view")
      ? "general"
      : requestedSection === "members" && !hasPermission(auth, "members.view")
        ? "general"
        : requestedSection === "roles" && !hasPermission(auth, "roles.view")
          ? "general"
          : requestedSection;

  if (activeSection === "general") {
    return <GeneralSettings />;
  }

  if (activeSection === "teams") {
    return <TeamsSettings />;
  }
  if (activeSection === "members") {
    return <MembersSettings />;
  }
  if (activeSection === "roles") {
    return <RolesSettings />;
  }

  if (activeSection === "integrations") {
    return <DiscordIntegrationSettings />;
  }

  return <GeneralSettings />;
}
