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
    iconClassName: "size-4",
  },

  private: {
    label: "Private",
    Icon: KeyIcon,
    iconClassName: "size-5",
  },
} satisfies Record<
  ProjectDto["visibility"],
  {
    label: string;
    Icon: typeof BriefcaseIcon;
    iconClassName: string;
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
      <SelectTrigger aria-label={`Project access: ${current.label}`} className={createAppearance ? "h-8 w-fit gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-muted-foreground shadow-xs [&>svg:last-child]:hidden" : "w-full"}>
        <CurrentIcon aria-hidden="true" className={current.iconClassName} />

        <span className="truncate">{current.label}</span>
      </SelectTrigger>

      <SelectContent align="start" alignItemWithTrigger={false} className={createAppearance ? "w-56 rounded-lg border border-border bg-popover p-1 shadow-md ring-0 before:hidden" : "w-44"}>
        <SelectGroup className="p-0">
          <SelectLabel className={createAppearance ? "px-2 py-1.5 text-sm font-medium text-popover-foreground" : undefined}>Project access</SelectLabel>

          {createAppearance ? <SelectSeparator className="-mx-1 my-1" /> : null}

          {values.map((accessValue) => {
            const option = accessConfig[accessValue];

            const OptionIcon = option.Icon;

            return (
              <SelectItem key={accessValue} value={accessValue} className={createAppearance ? "h-8 gap-2 rounded-lg py-1.5 pr-8 pl-2 text-sm data-selected:bg-muted dark:data-selected:bg-[#3a3a3a]" : undefined}>
                <OptionIcon aria-hidden="true" className={option.iconClassName} />

                {option.label}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
