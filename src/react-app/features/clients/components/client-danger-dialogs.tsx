import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getErrorMessage } from "@/lib/errors";
import { useArchiveClient } from "../hooks/use-archive-client";
import { useDeleteClient } from "../hooks/use-delete-client";

import type { ClientDto } from "../types";

type ArchiveClientDialogProps = {
  client: ClientDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived?: () => void;
};

export function ArchiveClientDialog({ client, open, onOpenChange, onArchived }: ArchiveClientDialogProps) {
  const archiveClient = useArchiveClient();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {client.name}?</AlertDialogTitle>
          <AlertDialogDescription>The client will be removed from the active client list. Its data remains stored.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archiveClient.isPending}>Cancel</AlertDialogCancel>

          <AlertDialogAction
            variant="destructive"
            disabled={archiveClient.isPending}
            onClick={() => {
              archiveClient.mutate(client.id, {
                onSuccess: () => {
                  onOpenChange(false);
                  toast.success("Client archived.");
                  onArchived?.();
                },

                onError: (error) => {
                  toast.error(getErrorMessage(error, "Failed to archive client."));
                },
              });
            }}
          >
            {archiveClient.isPending ? "Archiving…" : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DeleteClientDialogProps = {
  client: ClientDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteClientDialog({ client, open, onOpenChange, onDeleted }: DeleteClientDialogProps) {
  const deleteClient = useDeleteClient();
  const [confirmation, setConfirmation] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      setConfirmation("");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete {client.name}?</AlertDialogTitle>
          <AlertDialogDescription>This permanently removes the client. Projects linked to this client must be deleted first. There is no restore.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor={`delete-client-confirmation-${client.id}`} className="text-sm font-medium">
            Type <span className="font-semibold">{client.name}</span> to confirm
          </label>

          <input
            id={`delete-client-confirmation-${client.id}`}
            value={confirmation}
            autoComplete="off"
            disabled={deleteClient.isPending}
            onChange={(event) => {
              setConfirmation(event.target.value);
            }}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteClient.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={confirmation !== client.name || deleteClient.isPending}
            onClick={() => {
              deleteClient.mutate(client.id, {
                onSuccess: () => {
                  handleOpenChange(false);
                  toast.success("Client deleted.");

                  onDeleted?.();
                },

                onError: (error) => {
                  toast.error(getErrorMessage(error, "Failed to delete client."));
                },
              });
            }}
          >
            {deleteClient.isPending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
