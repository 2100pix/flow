import { Badge } from "@/components/ui/badge";

import { useDiscordIntegration } from "../hooks/use-discord-integration";

export function DiscordIntegrationSettings() {
  const { data: integration, isPending, isError } = useDiscordIntegration();

  const connected = integration?.connectionStatus === "connected";

  const statusLabel = !connected ? "Not connected" : integration.enabled ? "Enabled" : "Connected";

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Integrations</h1>

      <div className="mt-8">
        <div className="mx-auto mt-10 max-w-xl">
          <section>
            <p className="text-xs font-medium text-muted-foreground">Discord</p>

            <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card">
              <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Discord</p>

                  <p className="mt-0.5 text-xs text-muted-foreground">Discussion and task interaction layer for Flow.</p>
                </div>

                {!isPending && !isError ? <Badge variant={connected ? "secondary" : "outline"}>{statusLabel}</Badge> : null}
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
                      <span className="text-xs text-muted-foreground">Project category</span>

                      <span className="text-xs font-medium">{integration.projectCategoryId ? "Configured" : "Not selected"}</span>
                    </div>

                    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3">
                      <span className="text-xs text-muted-foreground">Sync</span>

                      <span className="text-xs font-medium">{integration.enabled ? "Enabled" : "Off"}</span>
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
