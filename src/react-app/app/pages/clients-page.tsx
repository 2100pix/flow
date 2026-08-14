import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";
import { useClients } from "@/features/clients/hooks/use-clients";
import { useCreateClient } from "@/features/clients/hooks/use-create-client";

export function ClientsPage() {
  const [name, setName] = useState("");

  const { data: auth } = useMe();

  const { data: clients = [], isPending, isError } = useClients();

  const createClient = useCreateClient();

  const canCreate = auth?.workspace.role === "owner" || auth?.workspace.role === "admin";

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Clients</h1>

            <p className="mt-1 text-sm text-muted-foreground">Studios and organizations currently working with INVS.</p>
          </div>

          {canCreate ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();

                const value = name.trim();

                if (!value) {
                  return;
                }

                createClient.mutate(
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
                onChange={(event) => {
                  setName(event.target.value);
                }}
                placeholder="Client name"
                maxLength={120}
                className="h-8 w-56 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />

              <Button type="submit" disabled={!name.trim() || createClient.isPending}>
                {createClient.isPending ? "Adding…" : "Add client"}
              </Button>
            </form>
          ) : null}
        </div>

        {createClient.isError ? <p className="text-sm text-destructive">{createClient.error.message}</p> : null}

        {isPending ? <p className="text-sm text-muted-foreground">Loading clients…</p> : null}

        {isError ? <p className="text-sm text-destructive">Unable to load clients.</p> : null}

        {!isPending && !isError && clients.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8">
            <p className="text-sm font-medium">No clients yet</p>

            <p className="mt-1 text-sm text-muted-foreground">Clients added to Flow will appear here.</p>
          </div>
        ) : null}

        {clients.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{client.name}</p>

                  <p className="mt-0.5 text-xs capitalize text-muted-foreground">{client.status}</p>
                </div>

                <p className="text-xs text-muted-foreground">{client.id}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
