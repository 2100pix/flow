import { UserIcon } from "@phosphor-icons/react";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";

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
    <Select
      value={value ?? NO_CLIENT_VALUE}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (!nextValue) {
          return;
        }

        onValueChange(nextValue === NO_CLIENT_VALUE ? null : String(nextValue));
      }}
    >
      <SelectTrigger aria-label={`Client: ${selectedClient?.name ?? "Not set"}`} className="h-8 w-fit max-w-48 gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-muted-foreground shadow-xs [&>svg:last-child]:hidden">
        <UserIcon aria-hidden="true" className="size-4" />

        <span className="max-w-36 truncate">{triggerLabel}</span>
      </SelectTrigger>

      <SelectContent align="start" alignItemWithTrigger={false} className="w-56 rounded-lg border border-border bg-popover p-1 shadow-md ring-0 before:hidden">
        <SelectGroup className="p-0">
          <SelectLabel className="px-2 py-1.5 text-sm font-medium text-popover-foreground">Client</SelectLabel>

          <SelectSeparator className="-mx-1 my-1" />

          <SelectItem value={NO_CLIENT_VALUE} className="h-8 gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm data-selected:bg-muted dark:data-selected:bg-[#3a3a3a]">
            <UserIcon aria-hidden="true" className="size-4" />
            No client
          </SelectItem>

          {loading ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">Loading clients…</p>
          ) : error ? (
            <p className="px-2 py-2 text-xs text-destructive">Unable to load clients.</p>
          ) : (
            clients.map((client) => (
              <SelectItem key={client.id} value={client.id} className="h-8 gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm data-selected:bg-muted dark:data-selected:bg-[#3a3a3a]">
                <UserIcon aria-hidden="true" className="size-4" />

                <span className="truncate">{client.name}</span>
              </SelectItem>
            ))
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
