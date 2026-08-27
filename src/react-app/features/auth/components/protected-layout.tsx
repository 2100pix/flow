import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router";

import { AppLayout } from "@/app/layouts/app-layout";
import { SESSION_INVALID_EVENT } from "@/lib/api";

import { useMe } from "../hooks/use-me";

export function ProtectedLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: auth, isPending, isError } = useMe();

  useEffect(() => {
    function handleSessionInvalid() {
      queryClient.clear();

      void navigate("/login", {
        replace: true,
      });
    }

    window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);

    return () => {
      window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
    };
  }, [navigate, queryClient]);

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
