import { useEffect, useRef, useState } from "react";
import { CaretDownIcon, GearSixIcon } from "@phosphor-icons/react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

export function WorkspaceMenu({ workspaceName, canViewSettings }: { workspaceName: string; canViewSettings: boolean }) {
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

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

  if (!canViewSettings) {
    return <p className="truncate text-sm font-semibold tracking-tight">{workspaceName}</p>;
  }

  return (
    <div ref={containerRef} className="relative min-w-0">
      <Button
        type="button"
        variant="ghost"
        className="h-8 min-w-0 gap-1.5 px-2"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        <span className="truncate text-sm font-semibold tracking-tight">{workspaceName}</span>

        <CaretDownIcon size={12} className="shrink-0 text-muted-foreground" />
      </Button>

      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          <Link
            to="/settings"
            role="menuitem"
            className="flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              setOpen(false);
            }}
          >
            <GearSixIcon size={15} />
            <span>Settings</span>
          </Link>
        </div>
      )}
    </div>
  );
}
