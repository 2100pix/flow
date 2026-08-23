import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { useMe } from "@/features/auth/hooks/use-me";
import { useArchiveClient } from "@/features/clients/hooks/use-archive-client";
import { useClient } from "@/features/clients/hooks/use-client";
import { useUpdateClient } from "@/features/clients/hooks/use-update-client";
import { hasPermission } from "@/features/auth/permissions";

import type { ClientDto, ClientStatus } from "@/features/clients/types";

type ClientEditorProps = {
  client: ClientDto;
  canEdit: boolean;
  canArchive: boolean;
};

function ClientEditor({ client, canEdit, canArchive }: ClientEditorProps) {
  const navigate = useNavigate();

  const [name, setName] = useState(client.name);

  const [status, setStatus] = useState<ClientStatus>(client.status);

  const updateClient = useUpdateClient();

  const archiveClient = useArchiveClient();

  return (
    <div className="space-y-8">
      <div className="rounded-lg border p-5">
        <div className="space-y-5">
          <div>
            <label htmlFor="client-name" className="mb-1.5 block text-sm font-medium">
              Name
            </label>

            <input
              id="client-name"
              value={name}
              disabled={!canEdit}
              maxLength={120}
              onChange={(event) => {
                setName(event.target.value);
              }}
              className="h-8 w-full max-w-md rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="client-status" className="mb-1.5 block text-sm font-medium">
              Status
            </label>

            <select
              id="client-status"
              value={status}
              disabled={!canEdit}
              onChange={(event) => {
                setStatus(event.target.value as ClientStatus);
              }}
              className="h-8 w-full max-w-xs rounded-lg border border-input bg-background px-2.5 text-sm outline-none disabled:opacity-60"
            >
              <option value="active">Active</option>

              <option value="inactive">Inactive</option>
            </select>
          </div>

          {canEdit ? (
            <Button
              disabled={!name.trim() || updateClient.isPending}
              onClick={() => {
                updateClient.mutate(
                  {
                    clientId: client.id,
                    input: {
                      name: name.trim(),
                      status,
                    },
                  },
                  {
                    onSuccess: () => {
                      toast.success("Client updated.");
                    },

                    onError: (error) => {
                      toast.error(getErrorMessage(error, "Failed to update client."));
                    },
                  },
                );
              }}
            >
              {updateClient.isPending ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
      </div>

      {canArchive ? (
        <div className="rounded-lg border border-destructive/20 p-5">
          <p className="text-sm font-medium">Archive client</p>

          <p className="mt-1 text-sm text-muted-foreground">Archived clients are removed from the active client list.</p>

          <Button
            className="mt-4"
            variant="destructive"
            disabled={archiveClient.isPending}
            onClick={() => {
              const confirmed = window.confirm(`Archive ${client.name}?`);

              if (!confirmed) {
                return;
              }

              archiveClient.mutate(client.id, {
                onSuccess: () => {
                  toast.success("Client archived.");

                  void navigate("/clients", {
                    replace: true,
                  });
                },

                onError: (error) => {
                  toast.error(getErrorMessage(error, "Failed to archive client."));
                },
              });
            }}
          >
            {archiveClient.isPending ? "Archiving…" : "Archive client"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ClientDetailPage() {
  const { clientId } = useParams();

  const { data: auth } = useMe();

  const { data: client, isPending, isError } = useClient(clientId);

  if (!clientId) {
    return null;
  }
  const canEdit = hasPermission(auth, "clients.edit");

  const canArchive = hasPermission(auth, "clients.archive");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <Link to="/clients" className="text-sm text-muted-foreground hover:text-foreground">
            Clients
          </Link>

          <h1 className="mt-3 text-xl font-semibold tracking-tight">{client?.name ?? "Client"}</h1>
        </div>

        {isPending ? <p className="text-sm text-muted-foreground">Loading client…</p> : null}

        {isError ? <p className="text-sm text-destructive">Unable to load client.</p> : null}

        {client ? <ClientEditor key={client.updatedAt} client={client} canEdit={canEdit} canArchive={canArchive} /> : null}
      </div>
    </div>
  );
}
