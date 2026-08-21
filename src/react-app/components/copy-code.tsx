import { useEffect, useRef, useState } from "react";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/utils";

type CopyCodeProps = {
  value: string;

  appearance?: "badge" | "plain";

  className?: string;
};

export function CopyCode({ value, appearance = "badge", className }: CopyCodeProps) {
  const [copied, setCopied] = useState(false);

  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function copyCode() {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);

        if (resetTimerRef.current !== null) {
          window.clearTimeout(resetTimerRef.current);
        }

        resetTimerRef.current = window.setTimeout(() => {
          setCopied(false);

          resetTimerRef.current = null;
        }, 1200);
      })
      .catch(() => {
        toast.error("Failed to copy code.");
      });
  }

  const trigger =
    appearance === "badge" ? (
      <Badge
        variant="outline"
        render={
          <button
            type="button"
            aria-label={`Copy ${value}`}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();

              copyCode();
            }}
          />
        }
        className={cn("cursor-copy font-mono text-[11px] tracking-wide text-muted-foreground hover:bg-muted", className)}
      >
        {value}
      </Badge>
    ) : (
      <button
        type="button"
        aria-label={`Copy ${value}`}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();

          copyCode();
        }}
        className={cn("cursor-copy outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      >
        {value}
      </button>
    );

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />

      <TooltipContent>{copied ? "Copied" : "Click to copy"}</TooltipContent>
    </Tooltip>
  );
}
