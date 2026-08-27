import { useCallback, useEffect, useState } from "react";
export type ThemePreference = "light" | "dark" | "system";
const THEME_STORAGE_KEY = "flow:theme";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function getThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

  return isThemePreference(stored) ? stored : "system";
}

export function applyTheme(theme: ThemePreference) {
  const resolvedDark = theme === "dark" || (theme === "system" && window.matchMedia(DARK_MEDIA_QUERY).matches);
  document.documentElement.classList.toggle("dark", resolvedDark);
  document.documentElement.style.colorScheme = resolvedDark ? "dark" : "light";
}

export function initializeTheme() {
  applyTheme(getThemePreference());
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(getThemePreference);

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") {
      return;
    }

    const media = window.matchMedia(DARK_MEDIA_QUERY);

    function handleChange() {
      applyTheme("system");
    }

    media.addEventListener("change", handleChange);

    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

    setThemeState(nextTheme);

    applyTheme(nextTheme);
  }, []);

  return {
    theme,
    setTheme,
  };
}
