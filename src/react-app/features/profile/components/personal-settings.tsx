import { useMemo, useState, type FormEvent } from "react";
import { CheckIcon, PlusIcon } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { useMe } from "@/features/auth/hooks/use-me";
import { useCreateMyExpertise, useMyExpertise, useUpdateMyExpertise } from "@/features/auth/hooks/use-my-expertise";
import { useRefreshDiscordProfile } from "@/features/auth/hooks/use-refresh-discord-profile";
import { useUpdateProfile } from "@/features/auth/hooks/use-update-profile";
import type { UpdateProfileInput } from "@/features/auth/types";

function haveSameIds(first: readonly string[], second: readonly string[]) {
  if (first.length !== second.length) {
    return false;
  }

  const secondSet = new Set(second);

  return first.every((id) => secondSet.has(id));
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

type TimeZoneOption = {
  value: string;

  label: string;
};

function getTimeZoneOptions(): TimeZoneOption[] {
  let zones: string[];

  try {
    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;

    if (typeof supportedValuesOf !== "function") {
      return [];
    }

    zones = supportedValuesOf("timeZone");
  } catch {
    return [];
  }

  return zones
    .slice()
    .sort((first, second) => first.localeCompare(second))
    .map((zone) => {
      let label = zone;

      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: zone,

          timeZoneName: "shortOffset",
        }).formatToParts(new Date());

        const offset = parts.find((part) => part.type === "timeZoneName")?.value;

        if (offset) {
          label = `(UTC${offset.replace("GMT", "")}) ${zone}`;
        }
      } catch {
        // Keep the zone name as the label.
      }

      return {
        value: zone,

        label,
      };
    });
}

const inputClassName = [
  "h-8 w-full",
  "rounded-md",
  "border border-input",
  "bg-background",
  "px-2.5",
  "text-sm",
  "outline-none",
  "transition-[border-color,box-shadow]",
  "sm:w-52",
  "focus-visible:border-ring",
  "focus-visible:ring-3",
  "focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed",
  "disabled:opacity-60",
].join(" ");

export function PersonalSettings() {
  const { data: auth } = useMe();

  const updateProfile = useUpdateProfile();
  const updateExpertise = useUpdateMyExpertise();
  const createExpertise = useCreateMyExpertise();
  const refreshDiscord = useRefreshDiscordProfile();

  const { data: expertiseTags = [] } = useMyExpertise();

  const timeZoneOptions = useMemo(() => getTimeZoneOptions(), []);

  const [firstName, setFirstName] = useState(() => auth?.user.firstName ?? "");
  const [lastName, setLastName] = useState(() => auth?.user.lastName ?? "");
  const [timeZone, setTimeZone] = useState(() => auth?.user.timeZone ?? getBrowserTimeZone());
  const [expertiseIds, setExpertiseIds] = useState<string[]>(() => (auth?.user.expertise ?? []).map((item) => item.id));
  const [creatingExpertise, setCreatingExpertise] = useState(false);
  const [expertiseName, setExpertiseName] = useState("");

  if (!auth) {
    return null;
  }

  const initialFirstName = auth.user.firstName ?? "";
  const initialLastName = auth.user.lastName ?? "";
  const initialTimeZone = auth.user.timeZone ?? getBrowserTimeZone();
  const initialExpertiseIds = auth.user.expertise.map((item) => item.id);

  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();

  const profileChanged = normalizedFirstName !== initialFirstName || normalizedLastName !== initialLastName || timeZone !== initialTimeZone;

  const expertiseChanged = !haveSameIds(expertiseIds, initialExpertiseIds);

  const hasChanges = profileChanged || expertiseChanged;

  const isSaving = updateProfile.isPending || updateExpertise.isPending;

  function createNewExpertise() {
    const name = expertiseName.trim();

    if (!name || createExpertise.isPending) {
      if (!name) {
        setCreatingExpertise(false);
      }

      return;
    }

    createExpertise.mutate(
      {
        name,
      },
      {
        onSuccess: (created) => {
          setExpertiseIds((current) => (current.includes(created.id) ? current : [...current, created.id]));

          setExpertiseName("");

          setCreatingExpertise(false);
        },

        onError: () => {
          toast.error("Failed to create expertise.");
        },
      },
    );
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges || isSaving) {
      return;
    }

    try {
      const operations: Promise<unknown>[] = [];

      if (profileChanged) {
        const input: UpdateProfileInput = {
          firstName: normalizedFirstName ? normalizedFirstName : null,

          lastName: normalizedLastName ? normalizedLastName : null,

          timeZone: timeZone ? timeZone : null,
        };

        operations.push(updateProfile.mutateAsync(input));
      }

      if (expertiseChanged) {
        operations.push(updateExpertise.mutateAsync({ expertiseIds }));
      }

      await Promise.all(operations);

      toast.success("Profile updated.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update profile."));
    }
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Personal</h1>

      <div className="mt-8">
        <div className="mx-auto mt-10 max-w-xl space-y-12">
          <section>
            <p className="text-xs font-medium text-muted-foreground">Profile</p>

            <form className="mt-3" onSubmit={handleSave}>
              <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                <div className="flex min-h-12 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium">Discord Profile</p>

                    <p className="mt-0.5 text-[11px] text-muted-foreground">Sync your display name and photo from Discord.</p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={refreshDiscord.isPending || isSaving}
                    className="shrink-0"
                    onClick={() => {
                      refreshDiscord.mutate(undefined, {
                        onSuccess: () => {
                          toast.success("Discord profile refreshed.");
                        },

                        onError: (error) => {
                          toast.error(getErrorMessage(error, "Failed to refresh Discord profile."));
                        },
                      });
                    }}
                  >
                    {refreshDiscord.isPending ? "Refreshing…" : "Refresh from Discord"}
                  </Button>
                </div>

                <div className="flex min-h-12 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="personal-first-name" className="text-xs font-medium">
                    First Name
                  </label>

                  <input
                    id="personal-first-name"
                    value={firstName}
                    maxLength={80}
                    disabled={isSaving}
                    onChange={(event) => {
                      setFirstName(event.target.value);
                    }}
                    className={inputClassName}
                  />
                </div>

                <div className="flex min-h-12 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="personal-last-name" className="text-xs font-medium">
                    Last Name
                  </label>

                  <input
                    id="personal-last-name"
                    value={lastName}
                    maxLength={80}
                    disabled={isSaving}
                    onChange={(event) => {
                      setLastName(event.target.value);
                    }}
                    className={inputClassName}
                  />
                </div>

                <div className="flex min-h-12 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="personal-time-zone" className="text-xs font-medium">
                    Timezone
                  </label>

                  <select
                    id="personal-time-zone"
                    value={timeZone}
                    disabled={isSaving}
                    onChange={(event) => {
                      setTimeZone(event.target.value);
                    }}
                    className={`${inputClassName} cursor-pointer`}
                  >
                    {timeZoneOptions.length === 0 ? <option value={timeZone}>{timeZone}</option> : null}

                    {timeZoneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex min-h-12 flex-col gap-3 px-4 py-3">
                  <p className="text-xs font-medium">Expertise</p>

                  <div className="flex flex-wrap gap-2">
                    {expertiseTags.map((item) => {
                      const selected = expertiseIds.includes(item.id);

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            setExpertiseIds(selected ? expertiseIds.filter((id) => id !== item.id) : [...expertiseIds, item.id]);
                          }}
                          className="
                            inline-flex h-7
                            items-center gap-1.5
                            rounded-full
                            border border-border
                            px-2.5 text-xs
                            transition-colors
                            hover:bg-muted
                            disabled:opacity-50
                          "
                        >
                          {item.name}

                          {selected ? <CheckIcon className="size-3.5" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}

                    {creatingExpertise ? (
                      <form
                        className="inline-flex"
                        onSubmit={(event) => {
                          event.preventDefault();

                          createNewExpertise();
                        }}
                      >
                        <input
                          autoFocus
                          value={expertiseName}
                          maxLength={80}
                          placeholder="Create new"
                          disabled={createExpertise.isPending}
                          onChange={(event) => {
                            setExpertiseName(event.target.value);
                          }}
                          onBlur={() => {
                            createNewExpertise();
                          }}
                          className="
                            h-7
                            w-auto
                            min-w-[92px]
                            max-w-[220px]
                            [field-sizing:content]
                            rounded-full
                            border border-input
                            bg-background
                            px-2.5
                            text-xs
                            outline-none
                            placeholder:text-muted-foreground
                            focus-visible:border-ring
                            focus-visible:ring-2
                            focus-visible:ring-ring/40
                            disabled:opacity-50
                          "
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          setCreatingExpertise(true);
                        }}
                        className="
                          inline-flex h-7
                          items-center gap-1
                          rounded-full
                          border border-border
                          px-2.5 text-xs
                          text-muted-foreground
                          transition-colors
                          hover:bg-muted
                          hover:text-foreground
                        "
                      >
                        <PlusIcon className="size-3.5" aria-hidden="true" />
                        Create new
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {hasChanges ? (
                <div className="mt-3 flex justify-end">
                  <Button type="submit" size="sm" disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              ) : null}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
