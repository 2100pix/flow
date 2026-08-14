import { useState } from "react";
import { XIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useCreateClient } from "@/features/clients/hooks/use-create-client";

export function CreateClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");

  const createClient = useCreateClient();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="create-client-title" className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="create-client-title" className="text-base font-semibold">
              Create client
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">Add a client to this workspace.</p>
          </div>

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <XIcon />
          </Button>
        </div>

        <form
          className="mt-5 space-y-4"
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
                  onClose();
                },
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="create-client-name" className="text-sm font-medium">
              Client name
            </label>

            <input
              id="create-client-name"
              value={name}
              maxLength={120}
              autoFocus
              placeholder="Client name"
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {createClient.isError && <p className="text-sm text-destructive">{createClient.error.message}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button type="submit" disabled={!name.trim() || createClient.isPending}>
              {createClient.isPending ? "Creating…" : "Create client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
