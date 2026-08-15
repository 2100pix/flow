import { useState } from "react";
import { useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";
import { TeamsSettings } from "@/features/teams/components/teams-settings";
import { useUpdateWorkspace } from "@/features/workspace/hooks/use-update-workspace";
import { cn } from "@/lib/utils";

const settingsSections = [
  {
    id: "general",
    label: "General",
  },
  {
    id: "teams",
    label: "Teams",
  },
  {
    id: "roles",
    label: "Roles & Permissions",
  },
  {
    id: "task-fields",
    label: "Task Fields",
  },
  {
    id: "task-appearance",
    label: "Task Appearance",
  },
] as const;

type SettingsSection = (typeof settingsSections)[number]["id"];

function isSettingsSection(value: string | null): value is SettingsSection {
  return settingsSections.some((section) => section.id === value);
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: auth } = useMe();

  const updateWorkspace = useUpdateWorkspace();

  const activeSectionValue = searchParams.get("section");

  const activeSection: SettingsSection = isSettingsSection(activeSectionValue) ? activeSectionValue : "general";

  const [workspaceName, setWorkspaceName] = useState(() => auth?.workspace.name ?? "");

  const canManageWorkspace = auth?.workspace.role === "owner" || auth?.workspace.role === "admin";

  const normalizedName = workspaceName.trim();

  const hasNameChange = Boolean(auth) && normalizedName !== auth?.workspace.name;

  function selectSection(section: SettingsSection) {
    const next = new URLSearchParams();

    if (section !== "general") {
      next.set("section", section);
    }

    setSearchParams(next);
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Workspace Settings</h1>

          <p className="mt-1 text-sm text-muted-foreground">Configure how this workspace operates.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="space-y-1">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={cn("flex h-9 w-full items-center rounded-md px-3 text-left text-sm transition-colors", "text-muted-foreground hover:bg-muted hover:text-foreground", activeSection === section.id && "bg-muted text-foreground")}
                onClick={() => {
                  selectSection(section.id);
                }}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {activeSection === "general" && (
              <section className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold">General</h2>

                  <p className="mt-1 text-sm text-muted-foreground">Basic workspace information.</p>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
                  <form
                    className="max-w-xl space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();

                      if (!canManageWorkspace || !normalizedName || !hasNameChange) {
                        return;
                      }

                      updateWorkspace.mutate({
                        name: normalizedName,
                      });
                    }}
                  >
                    <div className="space-y-1.5">
                      <label htmlFor="workspace-name" className="text-sm font-medium">
                        Workspace name
                      </label>

                      <input
                        id="workspace-name"
                        value={workspaceName}
                        maxLength={120}
                        disabled={!canManageWorkspace}
                        onChange={(event) => {
                          setWorkspaceName(event.target.value);
                        }}
                        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      />

                      <p className="text-xs text-muted-foreground">This name is shown across the Flow workspace.</p>
                    </div>

                    {!canManageWorkspace && <p className="text-sm text-muted-foreground">Only workspace owners and admins can change this setting.</p>}

                    {updateWorkspace.isError && <p className="text-sm text-destructive">{updateWorkspace.error.message}</p>}

                    {updateWorkspace.isSuccess && !hasNameChange && <p className="text-sm text-muted-foreground">Workspace updated.</p>}

                    {canManageWorkspace && (
                      <Button type="submit" disabled={!normalizedName || !hasNameChange || updateWorkspace.isPending}>
                        {updateWorkspace.isPending ? "Saving…" : "Save changes"}
                      </Button>
                    )}
                  </form>
                </div>
              </section>
            )}
            {activeSection === "teams" && <TeamsSettings />}
            {activeSection !== "general" && activeSection !== "teams" && (
              <section>
                <div>
                  <h2 className="text-base font-semibold">{settingsSections.find((section) => section.id === activeSection)?.label}</h2>

                  <p className="mt-1 text-sm text-muted-foreground">This section is prepared for the next workspace customization milestone.</p>
                </div>

                <div className="mt-6 rounded-xl border border-dashed border-border p-8">
                  <p className="text-sm text-muted-foreground">No settings available here yet.</p>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
