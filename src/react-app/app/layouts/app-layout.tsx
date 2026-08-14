import { useState } from "react";
import { BuildingsIcon, FolderIcon, GearSixIcon, HouseIcon, PlusIcon, SidebarSimpleIcon, UsersIcon } from "@phosphor-icons/react";
import { Link, NavLink, Outlet } from "react-router";

import { AccountMenu } from "@/app/components/account-menu";
import { Button } from "@/components/ui/button";
import type { AuthContext } from "@/features/auth/types";
import { useProjects } from "@/features/projects/hooks/use-projects";
import type { ProjectDto } from "@/features/projects/types";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "flow:sidebar-collapsed";

const mainNavigation = [
  {
    label: "Home",
    href: "/",
    icon: HouseIcon,
  },
];

const clientsNavigationItem = {
  label: "Clients",
  href: "/clients",
  icon: BuildingsIcon,
};

const projectsNavigationItem = {
  label: "Projects",
  href: "/projects",
  icon: FolderIcon,
};

const manageNavigation = [
  {
    label: "Members",
    href: "/members",
    icon: UsersIcon,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: GearSixIcon,
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

function QuickCreateButton({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} aria-label={label} title={label} className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
      <PlusIcon size={14} />
    </Link>
  );
}

function SpaceNavigation({ collapsed, projects, canCreate }: { collapsed: boolean; projects: ProjectDto[]; canCreate: boolean }) {
  if (collapsed) {
    return (
      <div className="space-y-1">
        <NavigationLink item={clientsNavigationItem} collapsed />

        <NavigationLink item={projectsNavigationItem} collapsed />
      </div>
    );
  }

  const visibleProjects = projects.slice(0, 6);

  return (
    <div>
      <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40">Space</p>

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <NavigationLink item={clientsNavigationItem} collapsed={false} />
          </div>

          {canCreate && <QuickCreateButton to="/clients?create=client" label="Create client" />}
        </div>

        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <NavigationLink item={projectsNavigationItem} collapsed={false} />
          </div>

          {canCreate && <QuickCreateButton to="/projects?create=project" label="Create project" />}
        </div>

        {visibleProjects.length > 0 && (
          <div className="space-y-0.5 pb-1 pl-6">
            {visibleProjects.map((project) => (
              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                className={({ isActive }) =>
                  cn("block truncate rounded-md px-2 py-1.5 text-xs transition-colors", "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", isActive && "bg-sidebar-accent text-sidebar-accent-foreground")
                }
              >
                {project.name}
              </NavLink>
            ))}

            {projects.length > 6 && (
              <Link to="/projects" className="block rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground">
                See all projects
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
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
  const { data: projects = [] } = useProjects();

  const canCreate = auth.workspace.role === "owner" || auth.workspace.role === "admin";

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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background px-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* Replace this temporary Flow mark with the final logo asset when branding is ready. */}
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold" aria-label="Flow">
            F
          </div>
          {/* Replace hardcoded workspace name with workspace data in 8.5K. */}
          <p className="truncate text-sm font-semibold tracking-tight">{auth.workspace.name}</p>
        </div>

        <AccountMenu auth={auth} />
      </header>

      <div className="flex min-h-[calc(100vh-3rem)]">
        <aside className={cn("flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground", "transition-[width] duration-200", sidebarCollapsed ? "w-16" : "w-60")}>
          <div className={cn("flex h-11 shrink-0 items-center px-2", sidebarCollapsed ? "justify-center" : "justify-end")}>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSidebar}>
              <SidebarSimpleIcon />
            </Button>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-2">
            <div className="space-y-1">
              {mainNavigation.map((item) => (
                <NavigationLink key={item.href} item={item} collapsed={sidebarCollapsed} />
              ))}
            </div>

            <SpaceNavigation collapsed={sidebarCollapsed} projects={projects} canCreate={canCreate} />

            <NavigationGroup label="Manage" items={manageNavigation} collapsed={sidebarCollapsed} />
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
