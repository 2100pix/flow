import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "@/lib/query-client";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}

      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
