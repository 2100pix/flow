import { useState, type ReactNode } from "react";
import { BuildingsIcon, CaretDownIcon, FolderIcon, HouseIcon, PlusIcon, SidebarSimpleIcon, UsersIcon } from "@phosphor-icons/react";
import { Link, NavLink, Outlet } from "react-router";

import { AccountMenu } from "@/app/components/account-menu";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/features/auth/permissions";
import { WorkspaceMenu } from "@/app/components/workspace-menu";

import type { AuthContext } from "@/features/auth/types";
import { useProjects } from "@/features/projects/hooks/use-projects";
import type { ProjectDto } from "@/features/projects/types";
import { cn } from "@/lib/utils";

const SIDEBAR_HIDDEN_KEY = "flow:sidebar-hidden";

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof HouseIcon;
};

const homeNavigationItem: NavigationItem = {
  label: "Home",
  href: "/",
  icon: HouseIcon,
};

const clientsNavigationItem: NavigationItem = {
  label: "Clients",
  href: "/clients",
  icon: BuildingsIcon,
};

const projectsNavigationItem: NavigationItem = {
  label: "Projects",
  href: "/projects",
  icon: FolderIcon,
};

const membersNavigationItem: NavigationItem = {
  label: "Members",
  href: "/members",
  icon: UsersIcon,
};

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
      <Icon size={16} weight="regular" className="shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

function QuickCreateButton({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} aria-label={label} title={label} className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <PlusIcon size={14} />
    </Link>
  );
}

function SectionHeader({ label, expanded, onToggle, action }: { label: string; expanded: boolean; onToggle: () => void; action?: ReactNode }) {
  return (
    <div className="mb-1 flex h-7 items-center">
      <button
        type="button"
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 items-center px-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70"
        onClick={onToggle}
      >
        {label}
      </button>

      {action}

      <button
        type="button"
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
        aria-expanded={expanded}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={onToggle}
      >
        <CaretDownIcon size={12} className={cn("transition-transform duration-150", !expanded && "-rotate-90")} />
      </button>
    </div>
  );
}

function DatabaseNavigation({ canViewClients, canViewMembers, expanded, onToggle }: { canViewClients: boolean; canViewMembers: boolean; expanded: boolean; onToggle: () => void }) {
  const items: NavigationItem[] = [];

  if (canViewClients) {
    items.push(clientsNavigationItem);
  }

  if (canViewMembers) {
    items.push(membersNavigationItem);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionHeader label="Database" expanded={expanded} onToggle={onToggle} />

      {expanded && (
        <div className="space-y-1">
          {items.map((item) => (
            <NavigationLink key={item.href} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
function NavigationGroup({ label, items }: { label: string; items: NavigationItem[] }) {
  if (items.length === 0) {
    return null;
  }

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
  const canViewHome = hasPermission(auth, "dashboard.view");
  const canViewClients = hasPermission(auth, "clients.view");
  const canViewProjects = hasPermission(auth, "projects.view");
  const canCreateProjects = hasPermission(auth, "projects.create");
  const canViewMembers = hasPermission(auth, "members.view");
  const canViewSettings = hasPermission(auth, "settings.view");

  const workspaceInitial = auth.workspace.name.trim().charAt(0).toUpperCase() || "?";

  const { data: projects = [] } = useProjects(canViewProjects);

  const [sidebarHidden, setSidebarHidden] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_HIDDEN_KEY) === "true";
  });

  const [spaceExpanded, setSpaceExpanded] = useState(true);
  const [databaseExpanded, setDatabaseExpanded] = useState(true);

  function toggleSidebar() {
    const nextValue = !sidebarHidden;

    setSidebarHidden(nextValue);

    window.localStorage.setItem(SIDEBAR_HIDDEN_KEY, String(nextValue));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={sidebarHidden ? "Open sidebar" : "Hide sidebar"} title={sidebarHidden ? "Open sidebar" : "Hide sidebar"} onClick={toggleSidebar}>
            <SidebarSimpleIcon />
          </Button>
          {/* Replace this temporary Flow mark with the final logo asset when branding is ready. */}
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold" aria-hidden="true">
            {workspaceInitial}
          </div>

          <WorkspaceMenu workspaceName={auth.workspace.name} canViewSettings={canViewSettings} />

          <p className="truncate text-sm font-semibold tracking-tight">{auth.workspace.name}</p>
        </div>

        <AccountMenu auth={auth} />
      </header>

      <div className="flex min-h-[calc(100vh-3rem)]">
        {!sidebarHidden && (
          <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-2">
              {canViewHome && (
                <div className="space-y-1">
                  <NavigationLink item={homeNavigationItem} />
                </div>
              )}

              <SpaceNavigation
                projects={projects}
                canViewProjects={canViewProjects}
                canCreateProjects={canCreateProjects}
                expanded={spaceExpanded}
                onToggle={() => {
                  setSpaceExpanded((current) => !current);
                }}
              />

              <DatabaseNavigation
                canViewClients={canViewClients}
                canViewMembers={canViewMembers}
                expanded={databaseExpanded}
                onToggle={() => {
                  setDatabaseExpanded((current) => !current);
                }}
              />
            </nav>
          </aside>
        )}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
