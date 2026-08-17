import { useEffect, useState, type ReactNode } from "react";
import { BuildingsIcon, CaretDownIcon, FolderIcon, HouseIcon, PlusIcon, SidebarSimpleIcon, UsersIcon } from "@phosphor-icons/react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

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

const membersNavigationItem: NavigationItem = {
  label: "Members",
  href: "/members",
  icon: UsersIcon,
};
type CollapsedActiveProject = {
  projectId: string;
  locationKey: string;
};

function getActiveProjectId(pathname: string) {
  const match = /^\/projects\/([^/]+)(?:\/|$)/.exec(pathname);

  return match?.[1] ?? null;
}

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

function ProjectNavigation({ project, expanded, active, onToggle }: { project: ProjectDto; expanded: boolean; active: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-0.5">
      <div className="flex h-8 items-center gap-1">
        <Link
          to={`/projects/${project.id}`}
          className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 text-sm transition-colors", "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", active && "text-sidebar-foreground")}
        >
          <FolderIcon size={15} weight="regular" className="shrink-0" />

          <span className="truncate">{project.name}</span>
        </Link>

        <button
          type="button"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${project.name}`}
          aria-expanded={expanded}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onToggle}
        >
          <CaretDownIcon size={12} className={cn("transition-transform duration-150", !expanded && "-rotate-90")} />
        </button>
      </div>

      {expanded && (
        <div className="ml-[18px] space-y-0.5 border-l border-sidebar-border/70 pl-3">
          <NavLink
            to={`/projects/${project.id}`}
            end
            className={({ isActive }) =>
              cn(
                "relative flex h-7 items-center rounded-md px-2 text-xs transition-colors",
                "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-sidebar-border before:content-['']",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )
            }
          >
            Overview
          </NavLink>

          <NavLink
            to={`/projects/${project.id}/board`}
            end
            className={({ isActive }) =>
              cn(
                "relative flex h-7 items-center rounded-md px-2 text-xs transition-colors",
                "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:bg-sidebar-border before:content-['']",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              )
            }
          >
            Task List
          </NavLink>
        </div>
      )}
    </div>
  );
}
function SpaceNavigation({
  projects,
  canViewProjects,
  canCreateProjects,
  expanded,
  onToggle,
  activeProjectId,
  expandedProjectIds,
  collapsedActiveProject,
  locationKey,
  onToggleProject,
}: {
  projects: ProjectDto[];
  canViewProjects: boolean;
  canCreateProjects: boolean;
  expanded: boolean;
  onToggle: () => void;
  activeProjectId: string | null;
  expandedProjectIds: Set<string>;
  collapsedActiveProject: CollapsedActiveProject | null;
  locationKey: string;
  onToggleProject: (projectId: string) => void;
}) {
  if (!canViewProjects) {
    return null;
  }

  return (
    <div>
      <SectionHeader label="Space" expanded={expanded} onToggle={onToggle} action={canCreateProjects ? <QuickCreateButton to="/projects?create=project" label="Create project" /> : undefined} />

      {expanded && (
        <div className="space-y-0.5">
          {projects.map((project) => {
            const active = activeProjectId === project.id;

            const activeManuallyCollapsed = active && collapsedActiveProject?.projectId === project.id && collapsedActiveProject.locationKey === locationKey;

            const projectExpanded = expandedProjectIds.has(project.id) || (active && !activeManuallyCollapsed);

            return (
              <ProjectNavigation
                key={project.id}
                project={project}
                expanded={projectExpanded}
                active={active}
                onToggle={() => {
                  onToggleProject(project.id);
                }}
              />
            );
          })}
        </div>
      )}
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

export function AppLayout({ auth }: { auth: AuthContext }) {
  const location = useLocation();

  const activeProjectId = getActiveProjectId(location.pathname);
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

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [spaceExpanded, setSpaceExpanded] = useState(true);
  const [databaseExpanded, setDatabaseExpanded] = useState(true);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => new Set());
  const [collapsedActiveProject, setCollapsedActiveProject] = useState<CollapsedActiveProject | null>(null);

  useEffect(() => {
    if (!mobileSidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSidebarOpen]);

  function toggleSidebar() {
    const nextValue = !sidebarHidden;

    setSidebarHidden(nextValue);

    window.localStorage.setItem(SIDEBAR_HIDDEN_KEY, String(nextValue));
  }

  function toggleProject(projectId: string) {
    const active = activeProjectId === projectId;

    const manuallyExpanded = expandedProjectIds.has(projectId);

    const activeManuallyCollapsed = active && collapsedActiveProject?.projectId === projectId && collapsedActiveProject.locationKey === location.key;

    const currentlyExpanded = manuallyExpanded || (active && !activeManuallyCollapsed);

    if (currentlyExpanded) {
      setExpandedProjectIds((current) => {
        if (!current.has(projectId)) {
          return current;
        }

        const next = new Set(current);

        next.delete(projectId);

        return next;
      });

      if (active) {
        setCollapsedActiveProject({
          projectId,
          locationKey: location.key,
        });
      }

      return;
    }

    if (active) {
      setCollapsedActiveProject(null);

      return;
    }

    setExpandedProjectIds((current) => {
      const next = new Set(current);

      next.add(projectId);

      return next;
    });
  }

  function renderSidebarNavigation(onNavigate?: () => void) {
    return (
      <nav
        className="flex-1 space-y-4 overflow-y-auto px-2 py-3"
        onClick={(event) => {
          if (!onNavigate) {
            return;
          }

          if (event.target instanceof Element && event.target.closest("a")) {
            onNavigate();
          }
        }}
      >
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
          activeProjectId={activeProjectId}
          expandedProjectIds={expandedProjectIds}
          collapsedActiveProject={collapsedActiveProject}
          locationKey={location.key}
          onToggleProject={toggleProject}
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
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="ghost" size="icon-sm" className="hidden md:inline-flex" aria-label={sidebarHidden ? "Open sidebar" : "Hide sidebar"} title={sidebarHidden ? "Open sidebar" : "Hide sidebar"} onClick={toggleSidebar}>
            <SidebarSimpleIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"}
            title={mobileSidebarOpen ? "Close navigation" : "Open navigation"}
            aria-controls="mobile-sidebar"
            aria-expanded={mobileSidebarOpen}
            onClick={() => {
              setMobileSidebarOpen((current) => !current);
            }}
          >
            <SidebarSimpleIcon />
          </Button>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold" aria-hidden="true">
            {workspaceInitial}
          </div>
          <div className="min-w-0 max-w-[42vw] sm:max-w-none">
            <WorkspaceMenu workspaceName={auth.workspace.name} canViewSettings={canViewSettings} />
          </div>
        </div>

        <AccountMenu auth={auth} />
      </header>

      <div className="flex min-h-[calc(100vh-3rem)]">
        {!sidebarHidden && <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">{renderSidebarNavigation()}</aside>}
        {mobileSidebarOpen && (
          <div className="fixed inset-x-0 bottom-0 top-12 z-30 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-black/30"
              onClick={() => {
                setMobileSidebarOpen(false);
              }}
            />

            <aside id="mobile-sidebar" aria-label="Primary navigation" className="relative z-10 flex h-full w-60 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl">
              {renderSidebarNavigation(() => {
                setMobileSidebarOpen(false);
              })}
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
