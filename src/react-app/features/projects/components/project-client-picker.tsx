import { BriefcaseIcon, CaretDownIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import type { ClientDto } from "@/features/clients/types";

const NO_CLIENT_VALUE = "__flow_no_client__";

type ProjectClientPickerProps = {
  value: string | null;
  clients: ClientDto[];
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
};

export function ProjectClientPicker({ value, clients, onValueChange, disabled = false, loading = false, error = false }: ProjectClientPickerProps) {
  const selectedClient = clients.find((client) => client.id === value);

  const triggerLabel = selectedClient?.name ?? "Client";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} render={<Button type="button" variant="outline" size="sm" className="min-w-0 max-w-48 gap-1.5 px-2.5 font-normal" aria-label={`Client: ${selectedClient?.name ?? "Not set"}`} />}>
        <BriefcaseIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />

        <span className="truncate">{triggerLabel}</span>

        <CaretDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Client</DropdownMenuLabel>

          {loading ? (
            <p className="px-1.5 py-2 text-xs text-muted-foreground">Loading clients…</p>
          ) : error ? (
            <p className="px-1.5 py-2 text-xs text-destructive">Unable to load clients.</p>
          ) : (
            <DropdownMenuRadioGroup
              value={value ?? NO_CLIENT_VALUE}
              onValueChange={(nextValue) => {
                onValueChange(nextValue === NO_CLIENT_VALUE ? null : nextValue);
              }}
            >
              <DropdownMenuRadioItem value={NO_CLIENT_VALUE}>
                <BriefcaseIcon aria-hidden="true" />
                No client
              </DropdownMenuRadioItem>

              {clients.map((client) => (
                <DropdownMenuRadioItem key={client.id} value={client.id}>
                  <BriefcaseIcon aria-hidden="true" />

                  <span className="truncate">{client.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
