import { NavLink, Outlet } from "react-router";

import { cn } from "@/lib/utils";

const navigation = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "Clients",
    href: "/clients",
  },
  {
    label: "Projects",
    href: "/projects",
  },
  {
    label: "Members",
    href: "/members",
  },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center px-5">
          <span className="text-sm font-semibold tracking-tight">Flow</span>
        </div>

        <nav className="flex-1 px-3">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  cn("flex h-8 items-center rounded-md px-2.5 text-sm transition-colors", "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", isActive && "bg-sidebar-accent text-sidebar-accent-foreground")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="px-2 py-1">
            <p className="text-sm font-medium">INVS Studio</p>
            <p className="text-xs text-sidebar-foreground/60">Workspace</p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
