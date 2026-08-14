import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initializeTheme } from "@/features/appearance/theme";

import { AppProviders } from "@/app/providers";
import App from "@/App";

import "./index.css";

initializeTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
