import { BuildingsIcon, FolderIcon, HouseIcon, SignOutIcon, UsersIcon } from "@phosphor-icons/react";
import { NavLink, Outlet } from "react-router";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks/use-logout";
import type { AuthContext } from "@/features/auth/types";
import { cn } from "@/lib/utils";

const mainNavigation = [
  {
    label: "Home",
    href: "/",
    icon: HouseIcon,
  },
];

const workNavigation = [
  {
    label: "Clients",
    href: "/clients",
    icon: BuildingsIcon,
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderIcon,
  },
];

const manageNavigation = [
  {
    label: "Members",
    href: "/members",
    icon: UsersIcon,
  },
];

type NavigationItem = (typeof mainNavigation)[number];

function NavigationLink({ item }: { item: NavigationItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.href}
      end={item.href === "/"}
      className={({ isActive }) =>
        cn("flex h-8 items-center gap-2 rounded-md px-2.5 text-sm transition-colors", "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", isActive && "bg-sidebar-accent text-sidebar-accent-foreground")
      }
    >
      <Icon size={16} weight="regular" />
      <span>{item.label}</span>
    </NavLink>
  );
}

function NavigationGroup({ label, items }: { label: string; items: NavigationItem[] }) {
  return (
    <div>
      <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">{label}</p>

      <div className="space-y-1">
        {items.map((item) => (
          <NavigationLink key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}

export function AppLayout({ auth }: { auth: AuthContext }) {
  const logout = useLogout();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-12 shrink-0 items-center px-4">
          <span className="text-sm font-semibold tracking-tight">Flow</span>
        </div>

        <nav className="flex-1 space-y-5 px-2 py-2">
          <div className="space-y-1">
            {mainNavigation.map((item) => (
              <NavigationLink key={item.href} item={item} />
            ))}
          </div>

          <NavigationGroup label="Work" items={workNavigation} />

          <NavigationGroup label="Manage" items={manageNavigation} />
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className="mb-2 px-2.5 pt-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">INVS Studio</p>
          </div>

          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            {auth.user.avatarUrl ? (
              <img src={auth.user.avatarUrl} alt="" className="size-7 rounded-full" />
            ) : (
              <div className="flex size-7 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium">{auth.user.displayName.charAt(0).toUpperCase()}</div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{auth.user.displayName}</p>

              <p className="truncate text-xs capitalize text-sidebar-foreground/50">{auth.workspace.role}</p>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              disabled={logout.isPending}
              onClick={() => {
                logout.mutate();
              }}
            >
              <SignOutIcon />
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
