import { Button } from "@/components/ui/button";

export function AccessPendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Flow</p>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Access pending</h1>

            <p className="text-sm text-muted-foreground">Your account is waiting for workspace approval.</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Sign in again after a workspace administrator approves your access.</p>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            window.location.assign("/login");
          }}
        >
          Back to sign in
        </Button>
      </div>
    </div>
  );
}
