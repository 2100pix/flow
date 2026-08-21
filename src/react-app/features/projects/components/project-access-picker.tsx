import { BriefcaseIcon, KeyIcon } from "@phosphor-icons/react";

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";

import type { ProjectDto } from "@/features/projects/types";

type ProjectAccessPickerProps = {
  value: ProjectDto["visibility"];

  onValueChange: (value: ProjectDto["visibility"]) => void;

  canChoosePrivate: boolean;

  disabled?: boolean;

  appearance?: "default" | "create";
};

const accessConfig = {
  workspace: {
    label: "Workspace",
    Icon: BriefcaseIcon,
  },

  private: {
    label: "Private",
    Icon: KeyIcon,
  },
} satisfies Record<
  ProjectDto["visibility"],
  {
    label: string;
    Icon: typeof BriefcaseIcon;
  }
>;

export function ProjectAccessPicker({ value, onValueChange, canChoosePrivate, disabled = false, appearance = "default" }: ProjectAccessPickerProps) {
  const current = accessConfig[value];

  const CurrentIcon = current.Icon;

  const values: ProjectDto["visibility"][] = canChoosePrivate || value === "private" ? ["workspace", "private"] : ["workspace"];

  const createAppearance = appearance === "create";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue !== "workspace" && nextValue !== "private") {
          return;
        }

        onValueChange(nextValue);
      }}
    >
      <SelectTrigger aria-label={`Project access: ${current.label}`} className={createAppearance ? "h-8 w-auto min-w-0 gap-1.5 rounded-lg px-2.5 text-xs" : "h-9 w-full rounded-lg px-3 text-sm font-normal shadow-xs"}>
        {createAppearance ? <CurrentIcon className="size-4" aria-hidden="true" /> : null}

        <span className="min-w-0 truncate">{current.label}</span>
      </SelectTrigger>

      <SelectContent align="start" alignItemWithTrigger={createAppearance ? false : true}>
        <SelectGroup>
          <SelectLabel>{createAppearance ? "Project access" : "Access"}</SelectLabel>

          <SelectSeparator />

          {values.map((accessValue) => {
            const option = accessConfig[accessValue];

            const OptionIcon = option.Icon;

            return (
              <SelectItem key={accessValue} value={accessValue}>
                {createAppearance ? <OptionIcon className="size-4" aria-hidden="true" /> : null}

                {option.label}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
