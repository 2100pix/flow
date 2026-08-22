import { useMe } from "@/features/auth/hooks/use-me";
import { hasPermission } from "@/features/auth/permissions";

export function MyProjectsPage() {
  const { data: auth } = useMe();

  const canView = hasPermission(auth, "projects.view");

  if (auth && !canView) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">You do not have access to projects.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My Projects</h1>

          <p className="mt-1 text-sm text-muted-foreground">Projects relevant to your work.</p>
        </div>

        <div className="rounded-lg border border-dashed p-8">
          <p className="text-sm font-medium">My Projects</p>
        </div>
      </div>
    </div>
  );
}
