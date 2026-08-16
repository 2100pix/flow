import { Navigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/hooks/use-me";

export function LoginPage() {
  const { data: auth, isPending, isError } = useMe();

  if (isPending) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading Flow…</div>;
  }

  if (auth) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Flow</p>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Sign in to your workspace.</p>
          </div>
        </div>

        {isError ? <p className="text-sm text-destructive">Unable to connect to Flow.</p> : null}

        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            window.location.assign("/api/auth/discord");
          }}
        >
          Continue with Discord
        </Button>
      </div>
    </div>
  );
}
