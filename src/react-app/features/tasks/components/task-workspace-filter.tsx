import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

export function TaskWorkspaceFilterGroup({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>;
}

export function TaskWorkspaceFilterButton({
  active,
  children,
  onClick,
  ariaCurrent,
}: {
  active: boolean;

  children: ReactNode;

  onClick?: () => void;

  ariaCurrent?: "page";
}) {
  return (
    <Button type="button" variant="ghost" size="xs" aria-current={ariaCurrent} onClick={onClick} className={cn("h-6 rounded-full px-2.5 text-xs font-normal text-muted-foreground", active && "bg-foreground/20 text-foreground hover:bg-foreground/25")}>
      {children}
    </Button>
  );
}
