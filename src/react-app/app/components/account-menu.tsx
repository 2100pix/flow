import { useEffect, useRef, useState } from "react";
import { CaretDownIcon, CheckIcon, DesktopIcon, MoonIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks/use-logout";
import type { AuthContext } from "@/features/auth/types";
import { type ThemePreference, useTheme } from "@/features/appearance/theme";
import { resolvePersonName } from "@/lib/person-name";
import { cn } from "@/lib/utils";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof SunIcon;
}> = [
  {
    value: "light",
    label: "Light",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Dark",
    icon: MoonIcon,
  },
  {
    value: "system",
    label: "System",
    icon: DesktopIcon,
  },
];

export function AccountMenu({ auth }: { auth: AuthContext }) {
  const logout = useLogout();

  const { theme, setTheme } = useTheme();

  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const personName = resolvePersonName({
    firstName: auth.user.firstName,

    lastName: auth.user.lastName,

    displayName: auth.user.displayName,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      // SAFETY: pointerdown targets inside a document are always DOM nodes, which is all contains() requires.
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);

      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        className="h-8 gap-2 px-2"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {auth.user.avatarUrl ? (
          <img src={auth.user.avatarUrl} alt="" className="size-6 rounded-full" />
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">{personName.charAt(0).toUpperCase()}</div>
        )}

        <span className="hidden max-w-36 truncate text-sm sm:block">{personName}</span>

        <CaretDownIcon size={12} className="text-muted-foreground" />
      </Button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium">{personName}</p>

            <p className="mt-0.5 text-xs capitalize text-muted-foreground">{auth.workspace.customRole?.name ?? auth.workspace.role}</p>
          </div>

          <div className="my-1 h-px bg-border" />

          <div className="px-2 pb-1 pt-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Appearance</p>
          </div>

          {themeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                className={cn("flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors", "hover:bg-accent hover:text-accent-foreground")}
                onClick={() => {
                  setTheme(option.value);
                }}
              >
                <Icon size={15} className="shrink-0" />

                <span className="flex-1">{option.label}</span>

                {theme === option.value && <CheckIcon size={14} />}
              </button>
            );
          })}

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            disabled={logout.isPending}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              logout.mutate();
            }}
          >
            <SignOutIcon size={15} />

            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
