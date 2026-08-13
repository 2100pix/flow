import { Navigate } from "react-router";

import { AppLayout } from "@/app/layouts/app-layout";

import { useMe } from "../hooks/use-me";

export function ProtectedLayout() {
  const { data: auth, isPending, isError } = useMe();

  if (isPending) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading Flow…</div>;
  }

  if (isError) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-destructive">Unable to verify session.</div>;
  }

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout auth={auth} />;
}
