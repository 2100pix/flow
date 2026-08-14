import { useState } from "react";
import { BuildingsIcon, FolderIcon, HouseIcon, SidebarSimpleIcon, SignOutIcon, UsersIcon } from "@phosphor-icons/react";
import { NavLink, Outlet } from "react-router";

import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/hooks/use-logout";
import type { AuthContext } from "@/features/auth/types";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "flow:sidebar-collapsed";

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

function NavigationLink({ item, collapsed }: { item: NavigationItem; collapsed: boolean }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.href}
      end={item.href === "/"}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "flex h-8 items-center rounded-md text-sm transition-colors",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          collapsed ? "justify-center px-0" : "gap-2 px-2.5",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        )
      }
    >
      <Icon size={16} weight="regular" className="shrink-0" />

      <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
    </NavLink>
  );
}

function NavigationGroup({ label, items, collapsed }: { label: string; items: NavigationItem[]; collapsed: boolean }) {
  return (
    <div>
      {!collapsed && <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">{label}</p>}

      <div className="space-y-1">
        {items.map((item) => (
          <NavigationLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

export function AppLayout({ auth }: { auth: AuthContext }) {
  const logout = useLogout();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  });

  function toggleSidebar() {
    const nextValue = !sidebarCollapsed;

    setSidebarCollapsed(nextValue);

    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextValue));
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className={cn("flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground", "transition-[width] duration-200", sidebarCollapsed ? "w-16" : "w-60")}>
        <div className={cn("flex h-12 shrink-0 items-center", sidebarCollapsed ? "justify-center px-2" : "justify-between px-4")}>
          {/* Replace this temporary Flow wordmark/mark with the final logo asset when available. */}
          {sidebarCollapsed ? (
            <span className="flex size-8 items-center justify-center rounded-md text-sm font-semibold" aria-label="Flow">
              F
            </span>
          ) : (
            <span className="text-sm font-semibold tracking-tight">Flow</span>
          )}

          {!sidebarCollapsed && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={toggleSidebar}>
              <SidebarSimpleIcon />
            </Button>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="px-2 pb-1">
            <Button type="button" variant="ghost" size="icon-sm" className="w-full" aria-label="Expand sidebar" title="Expand sidebar" onClick={toggleSidebar}>
              <SidebarSimpleIcon />
            </Button>
          </div>
        )}

        <nav className={cn("flex-1 space-y-5 py-2", sidebarCollapsed ? "px-2" : "px-2")}>
          <div className="space-y-1">
            {mainNavigation.map((item) => (
              <NavigationLink key={item.href} item={item} collapsed={sidebarCollapsed} />
            ))}
          </div>

          <NavigationGroup label="Space" items={workNavigation} collapsed={sidebarCollapsed} />

          <NavigationGroup label="Manage" items={manageNavigation} collapsed={sidebarCollapsed} />
        </nav>

        <div className="border-t border-sidebar-border p-2">
          {!sidebarCollapsed && (
            <div className="mb-2 px-2.5 pt-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">INVS Studio</p>
            </div>
          )}

          <div className={cn("flex rounded-md", sidebarCollapsed ? "flex-col items-center gap-1 py-1.5" : "items-center gap-2 px-2 py-1.5")}>
            {auth.user.avatarUrl ? (
              <img src={auth.user.avatarUrl} alt="" title={sidebarCollapsed ? auth.user.displayName : undefined} className="size-7 shrink-0 rounded-full" />
            ) : (
              <div title={sidebarCollapsed ? auth.user.displayName : undefined} className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium">
                {auth.user.displayName.charAt(0).toUpperCase()}
              </div>
            )}

            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{auth.user.displayName}</p>

                <p className="truncate text-xs capitalize text-sidebar-foreground/50">{auth.workspace.role}</p>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sign out"
              title={sidebarCollapsed ? "Sign out" : undefined}
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
