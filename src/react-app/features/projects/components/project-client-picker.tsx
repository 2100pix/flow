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
      <SelectTrigger aria-label={`Client: ${selectedClient?.name ?? "Not set"}`} className="h-8 w-auto min-w-0 max-w-48 rounded-lg px-2.5 text-xs">
        <span className="max-w-36 truncate">{selectedClient?.name ?? "Client"}</span>
      </SelectTrigger>

      <SelectContent align="start" alignItemWithTrigger={false}>
        <SelectGroup>
          <SelectLabel>Client</SelectLabel>

          <SelectSeparator />

          <SelectItem value={NO_CLIENT_VALUE}>No client</SelectItem>

          {loading ? (
            <p className="px-1.5 py-2 text-xs text-muted-foreground">Loading clients…</p>
          ) : error ? (
            <p className="px-1.5 py-2 text-xs text-destructive">Unable to load clients.</p>
          ) : (
            clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                <span className="max-w-56 truncate">{client.name}</span>
              </SelectItem>
            ))
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
