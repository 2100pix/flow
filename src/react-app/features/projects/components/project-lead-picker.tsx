import { CaretDownIcon, PlusIcon, XIcon } from "@phosphor-icons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { PROJECT_LEAD_MAX_COUNT } from "@/features/projects/constants";

export type ProjectLeadOption = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type ProjectLeadPickerProps = {
  options: ProjectLeadOption[];
  value: string[];
  onValueChange: (userIds: string[]) => void;
  disabled?: boolean;
  candidatesLoading?: boolean;
  candidatesError?: boolean;
  canBrowseCandidates?: boolean;
};

function getInitials(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
}

export function ProjectLeadPicker({ options, value, onValueChange, disabled = false, candidatesLoading = false, candidatesError = false, canBrowseCandidates = true }: ProjectLeadPickerProps) {
  const selectedOptions = value.flatMap((userId) => {
    const option = options.find((candidate) => candidate.id === userId);

    return option ? [option] : [];
  });

  const candidates = options.filter((option) => !value.includes(option.id));

  const firstSelected = selectedOptions[0];

  const remainingCount = Math.max(selectedOptions.length - 1, 0);

  function addLead(userId: string) {
    if (disabled || value.includes(userId) || value.length >= PROJECT_LEAD_MAX_COUNT) {
      return;
    }

    onValueChange([...value, userId]);
  }

  function removeLead(userId: string) {
    if (disabled || value.length <= 1) {
      return;
    }

    onValueChange(value.filter((currentUserId) => currentUserId !== userId));
  }

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        render={<Button type="button" variant="outline" size="sm" className="max-w-48 min-w-0 justify-start gap-1.5 px-2 font-normal" aria-label={`Project leads: ${selectedOptions.map((lead) => lead.displayName).join(", ") || "none"}`} />}
      >
        {firstSelected ? (
          <Avatar size="sm" aria-hidden="true">
            {firstSelected.avatarUrl ? <AvatarImage src={firstSelected.avatarUrl} alt="" /> : null}

            <AvatarFallback>{getInitials(firstSelected.displayName)}</AvatarFallback>
          </Avatar>
        ) : null}

        <span className="min-w-0 truncate">{firstSelected ? firstSelected.displayName : "Project Lead"}</span>

        {remainingCount > 0 ? <span className="shrink-0 text-xs text-muted-foreground">+{remainingCount}</span> : null}

        <CaretDownIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-2">
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Project Lead</p>

        <div className="mt-1 space-y-1">
          {selectedOptions.map((lead) => (
            <div key={lead.id} className="group/lead flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
              <Avatar size="sm" aria-hidden="true">
                {lead.avatarUrl ? <AvatarImage src={lead.avatarUrl} alt="" /> : null}

                <AvatarFallback>{getInitials(lead.displayName)}</AvatarFallback>
              </Avatar>

              <span className="min-w-0 flex-1 truncate text-sm">{lead.displayName}</span>

              {value.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${lead.displayName} as project lead`}
                  disabled={disabled}
                  onClick={() => {
                    removeLead(lead.id);
                  }}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        {canBrowseCandidates && value.length < PROJECT_LEAD_MAX_COUNT ? (
          <>
            <div className="my-2 h-px bg-border/60" />

            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Add project lead</p>

            {candidatesLoading ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">Loading workspace members…</p>
            ) : candidatesError ? (
              <p className="px-2 py-2 text-xs text-destructive">Unable to load workspace members.</p>
            ) : candidates.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">No more workspace members.</p>
            ) : (
              <div className="space-y-1">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      addLead(candidate.id);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Avatar size="sm" aria-hidden="true">
                      {candidate.avatarUrl ? <AvatarImage src={candidate.avatarUrl} alt="" /> : null}

                      <AvatarFallback>{getInitials(candidate.displayName)}</AvatarFallback>
                    </Avatar>

                    <span className="min-w-0 flex-1 truncate">{candidate.displayName}</span>

                    <PlusIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}

        {value.length >= PROJECT_LEAD_MAX_COUNT ? <p className="mt-2 px-2 py-1 text-xs text-muted-foreground">Maximum {PROJECT_LEAD_MAX_COUNT} project leads.</p> : null}
      </PopoverContent>
    </Popover>
  );
}
