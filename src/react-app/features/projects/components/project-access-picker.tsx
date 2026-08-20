import { CaretDownIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import type { ProjectDto } from "@/features/projects/types";

type ProjectAccessPickerProps = {
  value: ProjectDto["visibility"];
  onValueChange: (value: ProjectDto["visibility"]) => void;
  canChoosePrivate: boolean;
  disabled?: boolean;
};

const accessLabels: Record<ProjectDto["visibility"], string> = {
  workspace: "Workspace",
  private: "Private",
};

export function ProjectAccessPicker({ value, onValueChange, canChoosePrivate, disabled = false }: ProjectAccessPickerProps) {
  const label = accessLabels[value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} render={<Button type="button" variant="outline" size="sm" className="min-w-0 gap-1.5 px-2.5 font-normal" aria-label={`Project access: ${label}`} />}>
        <span className="truncate">{label}</span>

        <CaretDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuLabel>Project Access</DropdownMenuLabel>

        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => {
            onValueChange(nextValue as ProjectDto["visibility"]);
          }}
        >
          <DropdownMenuRadioItem value="workspace">Workspace</DropdownMenuRadioItem>

          {canChoosePrivate ? <DropdownMenuRadioItem value="private">Private</DropdownMenuRadioItem> : null}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
