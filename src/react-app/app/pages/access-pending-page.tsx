import { Button } from "@/components/ui/button";
import { useContinuePendingAccess } from "@/features/auth/hooks/use-continue-pending-access";
import { ApiError } from "@/lib/api";

export function AccessPendingPage() {
  const continueAccess = useContinuePendingAccess();

  const errorCode = continueAccess.error instanceof ApiError ? continueAccess.error.code : null;

  const stillPending = errorCode === "ACCESS_REQUEST_PENDING";

  const rejected = errorCode === "ACCESS_REQUEST_REJECTED";

  const sessionUnavailable = errorCode === "PENDING_SESSION_REQUIRED" || errorCode === "PENDING_SESSION_INVALID" || errorCode === "PENDING_SESSION_EXPIRED";

  const unexpectedError = continueAccess.isError && !stillPending && !rejected && !sessionUnavailable;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Flow</p>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{rejected ? "Access not approved" : sessionUnavailable ? "Session expired" : "Access pending"}</h1>

            <p className="text-sm text-muted-foreground">
              {rejected
                ? "Your workspace access request was not approved."
                : sessionUnavailable
                  ? "Your temporary access session is no longer available."
                  : stillPending
                    ? "Your access is still waiting for workspace approval."
                    : "Your account is waiting for workspace approval."}
            </p>
          </div>
        </div>

        {!rejected && !sessionUnavailable ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Check again after a workspace administrator approves your access.</p>

            {unexpectedError ? <p className="text-sm text-destructive">Unable to check access. Try again.</p> : null}

            <Button
              className="w-full"
              disabled={continueAccess.isPending}
              onClick={() => {
                continueAccess.mutate(undefined, {
                  onSuccess: () => {
                    window.location.replace("/");
                  },
                });
              }}
            >
              {continueAccess.isPending ? "Checking access…" : "Check access"}
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
