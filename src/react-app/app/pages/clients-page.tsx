import { PlusIcon } from "@phosphor-icons/react";
import { Link, useSearchParams } from "react-router";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";
import { CreateClientDialog } from "@/features/clients/components/create-client-dialog";
import { useClients } from "@/features/clients/hooks/use-clients";
import { hasPermission } from "@/features/auth/permissions";

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: auth } = useMe();

  const canView = hasPermission(auth, "clients.view");

  const canCreate = hasPermission(auth, "clients.create");

  const { data: clients = [], isPending, isError } = useClients(canView);

  const createOpen = searchParams.get("create") === "client";
  if (auth && !canView) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">You do not have access to clients.</p>
      </div>
    );
  }
  function openCreate() {
    const next = new URLSearchParams(searchParams);

    next.set("create", "client");

    setSearchParams(next);
  }

  function closeCreate() {
    const next = new URLSearchParams(searchParams);

    next.delete("create");

    setSearchParams(next, {
      replace: true,
    });
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Clients</h1>

            <p className="mt-1 text-sm text-muted-foreground">Studios and organizations in this workspace.</p>
          </div>

          {canCreate && (
            <Button type="button" onClick={openCreate}>
              <PlusIcon />
              New client
            </Button>
          )}
        </div>

        {isPending && <p className="text-sm text-muted-foreground">Loading clients…</p>}

        {isError && <p className="text-sm text-destructive">Unable to load clients.</p>}

        {!isPending && !isError && clients.length === 0 && (
          <div className="rounded-lg border border-dashed p-8">
            <p className="text-sm font-medium">No clients yet</p>

            <p className="mt-1 text-sm text-muted-foreground">Clients added to Flow will appear here.</p>
          </div>
        )}

        {clients.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <Link key={client.id} to={`/clients/${client.id}`} className="group flex min-h-40 flex-col rounded-xl border border-border bg-card p-5 text-card-foreground transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">{client.name.charAt(0).toUpperCase()}</div>

                    <p className="truncate text-sm font-semibold">{client.name}</p>
                  </div>

                  <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px] capitalize text-muted-foreground">{client.status}</span>
                </div>

                <div className="mt-auto flex justify-end pt-6">
                  <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">Open client</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {canCreate && <CreateClientDialog open={createOpen} onClose={closeCreate} />}
    </div>
  );
}
