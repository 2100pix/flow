import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useCompletePendingAccess } from "@/features/auth/hooks/use-complete-pending-access";
import { usePendingAccessStatus } from "@/features/auth/hooks/use-pending-access-status";

export function AccessPendingPage() {
  const pendingStatus = usePendingAccessStatus();
  const completeAccess = useCompletePendingAccess();

  const status = pendingStatus.data;

  useEffect(() => {
    if (status !== "approved" || completeAccess.status !== "idle") {
      return;
    }

    completeAccess.mutate(undefined, {
      onSuccess: () => {
        window.location.replace("/");
      },
    });
  }, [completeAccess, status]);

  const pending = pendingStatus.isPending || status === "pending";

  const approved = status === "approved";

  const rejected = status === "rejected";

  const sessionUnavailable = pendingStatus.isError;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Flow</p>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{rejected ? "Access not approved" : sessionUnavailable ? "Session expired" : approved ? "Access approved" : "Access pending"}</h1>

            <p className="text-sm text-muted-foreground">
              {rejected
                ? "Your workspace access request was not approved."
                : sessionUnavailable
                  ? "Your temporary access session is no longer available."
                  : approved
                    ? "Your access was approved. Finishing sign in…"
                    : "Your account is waiting for workspace approval."}
            </p>
          </div>
        </div>

        {pending ? <p className="text-sm text-muted-foreground">This page will continue automatically once your access is approved.</p> : null}

        {completeAccess.isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Unable to finish signing in.</p>

            <Button
              className="w-full"
              onClick={() => {
                completeAccess.reset();
              }}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {rejected || sessionUnavailable ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.assign("/login");
            }}
          >
            Back to sign in
          </Button>
        ) : null}
      </div>
    </div>
  );
}
