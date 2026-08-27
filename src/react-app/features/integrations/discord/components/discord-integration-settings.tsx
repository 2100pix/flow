import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { hasPermission } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/hooks/use-me";

import { useSearchParams } from "react-router";

import { useUpdateDiscordIntegration } from "../hooks/use-update-discord-integration";
import { useDiscordIntegration } from "../hooks/use-discord-integration";
import { useDisconnectDiscordIntegration } from "../hooks/use-disconnect-discord-integration";
import { useDiscordCategories } from "../hooks/use-discord-categories";
import { useUpdateDiscordProjectCategory } from "../hooks/use-update-discord-project-category";
import { useDiscordRoles } from "../hooks/use-discord-roles";
import { useUpdateDiscordWorkspaceRole } from "../hooks/use-update-discord-workspace-role";
import { useUpdateDiscordReminderSettings } from "../hooks/use-update-discord-reminder-settings";

function getDiscordConnectionFeedback(value: string | null) {
  switch (value) {
    case "connected":
      return {
        kind: "success" as const,
        message: "Discord server connected successfully.",
      };

    case "denied":
      return {
        kind: "error" as const,
        message: "Discord authorization was cancelled.",
      };

    case "invalid_state":
      return {
        kind: "error" as const,
        message: "Discord authorization session was invalid or expired.",
      };

    case "token_exchange_failed":
      return {
        kind: "error" as const,
        message: "Discord authorization could not be completed.",
      };

    case "guild_missing":
      return {
        kind: "error" as const,
        message: "Discord did not return a server for this connection.",
      };

    case "bot_verification_failed":
      return {
        kind: "error" as const,
        message: "Flow could not verify the bot in the selected Discord server.",
      };

    case "guild_already_connected":
      return {
        kind: "error" as const,
        message: "This Discord server is already connected to another Flow workspace.",
      };

    default:
      return null;
  }
}

export function DiscordIntegrationSettings() {
  const { data: auth } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: integration, isPending, isError } = useDiscordIntegration();
  const disconnectDiscord = useDisconnectDiscordIntegration();
  const updateDiscord = useUpdateDiscordIntegration();
  const canManageIntegration = hasPermission(auth, "settings.manage");
  const feedback = getDiscordConnectionFeedback(searchParams.get("discord"));
  const connected = integration?.connectionStatus === "connected";
  const { data: categories = [], isPending: categoriesPending, isError: categoriesError } = useDiscordCategories(connected);
  const updateCategory = useUpdateDiscordProjectCategory();
  const { data: roles = [], isPending: rolesPending, isError: rolesError } = useDiscordRoles(connected && canManageIntegration);
  const updateWorkspaceRole = useUpdateDiscordWorkspaceRole();
  const updateReminders = useUpdateDiscordReminderSettings();
  const [reminderTimeZoneDraft, setReminderTimeZoneDraft] = useState<string | null>(null);
  const [reminderHourLocalDraft, setReminderHourLocalDraft] = useState<number | null>(null);
  const statusLabel = !connected ? "Not connected" : integration.enabled ? "Enabled" : "Connected";
  const reminderTimeZone = reminderTimeZoneDraft ?? integration?.reminders.timeZone ?? "UTC";
  const reminderHourLocal = reminderHourLocalDraft ?? integration?.reminders.hourLocal ?? 9;
  const reminderSettingsDirty = integration ? reminderTimeZone !== integration.reminders.timeZone || reminderHourLocal !== integration.reminders.hourLocal : false;

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Integrations</h1>
      <div className="mt-8">
        <div className="mx-auto mt-10 max-w-xl">
          {feedback ? (
            <div className={feedback.kind === "success" ? "mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-foreground" : "mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive"}>
              {feedback.message}
            </div>
          ) : null}
          <section>
            <p className="text-xs font-medium text-muted-foreground">Discord</p>

            <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card">
              <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Discord</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Discussion and task interaction layer for Flow.</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!isPending && !isError ? <Badge variant={connected ? "secondary" : "outline"}>{statusLabel}</Badge> : null}
                  {!isPending && !isError && canManageIntegration ? (
                    connected ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={disconnectDiscord.isPending}
                          onClick={() => {
                            window.location.assign("/api/integrations/discord/connect");
                          }}
                        >
                          Reconnect
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={disconnectDiscord.isPending}
                          onClick={() => {
                            const confirmed = window.confirm("Disconnect Discord from this workspace? Discord sync will remain off and the saved server connection will be removed from Flow.");

                            if (!confirmed) {
                              return;
                            }

                            disconnectDiscord.mutate(undefined, {
                              onSuccess: () => {
                                toast.success("Discord disconnected.");

                                const nextSearchParams = new URLSearchParams(searchParams);

                                nextSearchParams.delete("discord");

                                setSearchParams(nextSearchParams, {
                                  replace: true,
                                });
                              },

                              onError: (error) => {
                                toast.error(getErrorMessage(error, "Failed to disconnect Discord."));
                              },
                            });
                          }}
                        >
                          {disconnectDiscord.isPending ? "Disconnecting…" : "Disconnect"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          window.location.assign("/api/integrations/discord/connect");
                        }}
                      >
                        Connect Discord
                      </Button>
                    )
                  ) : null}
                </div>
              </div>

              <div className="border-t border-border/60">
                {isPending ? (
                  <div className="px-4 py-4">
                    <p className="text-xs text-muted-foreground">Loading Discord integration…</p>
                  </div>
                ) : isError ? (
                  <div className="px-4 py-4">
                    <p className="text-xs text-destructive">Unable to load Discord integration.</p>
                  </div>
                ) : integration ? (
                  <div className="divide-y divide-border/60">
                    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                      <span className="text-xs text-muted-foreground">Connection</span>
                      <span className="text-xs font-medium">{connected ? "Connected" : "Not connected"}</span>
                    </div>

                    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                      <span className="text-xs text-muted-foreground">Server</span>
                      <span className="max-w-64 truncate text-right text-xs font-medium">{integration.guild?.name ?? "—"}</span>
                    </div>

                    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Project category</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">New project forums will be created inside this category.</p>
                      </div>

                      {connected ? (
                        categoriesPending ? (
                          <span className="text-xs text-muted-foreground">Loading…</span>
                        ) : categoriesError ? (
                          <span className="text-xs text-destructive">Unable to load</span>
                        ) : canManageIntegration ? (
                          <select
                            value={integration.projectCategoryId ?? ""}
                            disabled={updateCategory.isPending || disconnectDiscord.isPending}
                            onChange={(event) => {
                              const value = event.target.value;

                              updateCategory.mutate(
                                {
                                  projectCategoryId: value || null,
                                },
                                {
                                  onSuccess: () => {
                                    toast.success("Project category updated.");
                                  },

                                  onError: (error) => {
                                    toast.error(getErrorMessage(error, "Failed to update project category."));
                                  },
                                },
                              );
                            }}
                            className="
                            h-8
                            w-52
                            rounded-md
                            border border-input
                            bg-background
                            px-2.5
                            text-xs
                            outline-none
                            focus-visible:border-ring
                            focus-visible:ring-3
                            focus-visible:ring-ring/50
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                          "
                          >
                            <option value="">No category</option>

                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-medium">{categories.find((category) => category.id === integration.projectCategoryId)?.name ?? "No category"}</span>
                        )
                      ) : (
                        <span className="text-xs font-medium">Not available</span>
                      )}
                    </div>

                    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Roles workspace</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Discord role that can view project forums. Private projects are always restricted to their Flow members.</p>
                      </div>

                      {connected ? (
                        rolesPending ? (
                          <span className="text-xs text-muted-foreground">Loading…</span>
                        ) : rolesError ? (
                          <span className="text-xs text-destructive">Unable to load</span>
                        ) : canManageIntegration ? (
                          <select
                            value={integration.workspaceDiscordRoleId ?? ""}
                            disabled={updateWorkspaceRole.isPending || disconnectDiscord.isPending}
                            onChange={(event) => {
                              const value = event.target.value;

                              updateWorkspaceRole.mutate(
                                {
                                  workspaceDiscordRoleId: value || null,
                                },
                                {
                                  onSuccess: () => {
                                    toast.success("Workspace role updated. Project forums are syncing.");
                                  },

                                  onError: (error) => {
                                    toast.error(getErrorMessage(error, "Failed to update workspace role."));
                                  },
                                },
                              );
                            }}
                            className="
                            h-8
                            w-52
                            rounded-md
                            border border-input
                            bg-background
                            px-2.5
                            text-xs
                            outline-none
                            focus-visible:border-ring
                            focus-visible:ring-3
                            focus-visible:ring-ring/50
                            disabled:cursor-not-allowed
                            disabled:opacity-60
                          "
                          >
                            <option value="">Everyone (open)</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-medium">{roles.find((role) => role.id === integration.workspaceDiscordRoleId)?.name ?? "Everyone"}</span>
                        )
                      ) : (
                        <span className="text-xs font-medium">Not available</span>
                      )}
                    </div>

                    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Sync</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Controls automatic Discord synchronization.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{integration.enabled ? "Enabled" : "Off"}</span>

                        {connected && canManageIntegration ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={integration.enabled ? "outline" : "default"}
                            disabled={updateDiscord.isPending || disconnectDiscord.isPending}
                            onClick={() => {
                              updateDiscord.mutate(
                                {
                                  enabled: !integration.enabled,
                                },
                                {
                                  onSuccess: () => {
                                    toast.success(integration.enabled ? "Discord sync disabled." : "Discord sync enabled.");
                                  },

                                  onError: (error) => {
                                    toast.error(getErrorMessage(error, "Failed to update Discord sync."));
                                  },
                                },
                              );
                            }}
                          >
                            {updateDiscord.isPending ? "Saving…" : integration.enabled ? "Disable" : "Enable"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Deadline reminders</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">DM Task leads and assignees one day before and on the due date.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{integration.reminders.enabled ? "Enabled" : "Off"}</span>

                        {connected && canManageIntegration ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={integration.reminders.enabled ? "outline" : "default"}
                            disabled={updateReminders.isPending || disconnectDiscord.isPending}
                            onClick={() => {
                              updateReminders.mutate(
                                {
                                  enabled: integration.reminders.enabled,

                                  timeZone: reminderTimeZone.trim(),

                                  hourLocal: reminderHourLocal,
                                },
                                {
                                  onSuccess: () => {
                                    toast.success("Reminder settings updated.");

                                    setReminderTimeZoneDraft(null);
                                    setReminderHourLocalDraft(null);
                                  },

                                  onError: (error) => {
                                    toast.error(getErrorMessage(error, "Failed to update reminders."));
                                  },
                                },
                              );
                            }}
                          >
                            {updateReminders.isPending ? "Saving…" : integration.reminders.enabled ? "Disable" : "Enable"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Reminder schedule</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Workspace timezone and local delivery hour.</p>
                      </div>

                      {connected ? (
                        canManageIntegration ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={reminderTimeZone}
                              disabled={updateReminders.isPending || disconnectDiscord.isPending}
                              onChange={(event) => {
                                setReminderTimeZoneDraft(event.target.value);
                              }}
                              aria-label="Reminder timezone"
                              placeholder="Asia/Jakarta"
                              className="
                              h-8
                              w-36
                              rounded-md
                              border border-input
                              bg-background
                              px-2.5
                              text-xs
                              outline-none
                              focus-visible:border-ring
                              focus-visible:ring-3
                              focus-visible:ring-ring/50
                              disabled:cursor-not-allowed
                              disabled:opacity-60
                            "
                            />

                            <select
                              value={reminderHourLocal}
                              disabled={updateReminders.isPending || disconnectDiscord.isPending}
                              onChange={(event) => {
                                setReminderHourLocalDraft(Number(event.target.value));
                              }}
                              aria-label="Reminder delivery hour"
                              className="
                              h-8
                              rounded-md
                              border border-input
                              bg-background
                              px-2.5
                              text-xs
                              outline-none
                              focus-visible:border-ring
                              focus-visible:ring-3
                              focus-visible:ring-ring/50
                              disabled:cursor-not-allowed
                              disabled:opacity-60
                            "
                            >
                              {Array.from({ length: 24 }, (_, hour) => (
                                <option key={hour} value={hour}>
                                  {String(hour).padStart(2, "0")}
                                  :00
                                </option>
                              ))}
                            </select>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!reminderSettingsDirty || updateReminders.isPending || disconnectDiscord.isPending || !reminderTimeZone.trim()}
                              onClick={() => {
                                updateReminders.mutate(
                                  {
                                    enabled: !integration.reminders.enabled,

                                    timeZone: reminderTimeZone.trim(),

                                    hourLocal: reminderHourLocal,
                                  },
                                  {
                                    onSuccess: () => {
                                      toast.success("Reminder schedule updated.");

                                      setReminderTimeZoneDraft(null);
                                      setReminderHourLocalDraft(null);
                                    },

                                    onError: (error) => {
                                      toast.error(getErrorMessage(error, "Failed to update reminder schedule."));
                                    },
                                  },
                                );
                              }}
                            >
                              {updateReminders.isPending ? "Saving…" : "Save"}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium">
                            {integration.reminders.timeZone} · {String(integration.reminders.hourLocal).padStart(2, "0")}
                            :00
                          </span>
                        )
                      ) : (
                        <span className="text-xs font-medium">Not available</span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
