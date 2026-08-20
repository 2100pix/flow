import { BuildingsIcon, CaretDownIcon, LockSimpleIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import type { ProjectDto } from "@/features/projects/types";

type ProjectAccessPickerProps = {
  value: ProjectDto["visibility"];
  onValueChange: (value: ProjectDto["visibility"]) => void;
  canChoosePrivate: boolean;
  disabled?: boolean;
};

const accessConfig = {
  workspace: {
    label: "Workspace",
    Icon: BuildingsIcon,
  },

  private: {
    label: "Private",
    Icon: LockSimpleIcon,
  },
} satisfies Record<
  ProjectDto["visibility"],
  {
    label: string;
    Icon: typeof BuildingsIcon;
  }
>;

export function ProjectAccessPicker({ value, onValueChange, canChoosePrivate, disabled = false }: ProjectAccessPickerProps) {
  const current = accessConfig[value];

  const CurrentIcon = current.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} render={<Button type="button" variant="outline" size="sm" className="min-w-0 gap-1.5 px-2.5 font-normal" aria-label={`Project access: ${current.label}`} />}>
        <CurrentIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />

        <span className="truncate">{current.label}</span>

        <CaretDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Project Access</DropdownMenuLabel>

          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(nextValue) => {
              onValueChange(nextValue as ProjectDto["visibility"]);
            }}
          >
            <DropdownMenuRadioItem value="workspace">
              <BuildingsIcon aria-hidden="true" />
              Workspace
            </DropdownMenuRadioItem>

            {canChoosePrivate ? (
              <DropdownMenuRadioItem value="private">
                <LockSimpleIcon aria-hidden="true" />
                Private
              </DropdownMenuRadioItem>
            ) : null}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
