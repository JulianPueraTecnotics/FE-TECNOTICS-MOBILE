import { Platform } from "react-native";
import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { ensureStorageHydrated, getItemSync, setItemSync } from "../utils/storage";

const THEME_STORAGE_KEY = "tecnotics-theme";

export type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function readStoredTheme(): ThemeMode | null {
  const stored = getItemSync(THEME_STORAGE_KEY) as ThemeMode | null;
  return stored === "light" || stored === "dark" ? stored : null;
}

function getInitialTheme(): ThemeMode {
  const stored = readStoredTheme();
  if (stored) return stored;
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    setItemSync(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void ensureStorageHydrated().then(() => {
      const stored = readStoredTheme();
      if (stored) setThemeState(stored);
    });
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
