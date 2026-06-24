import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  ensureStorageHydrated,
  getItemSync,
  hasWebStorage,
  setItemSync,
} from "../utils/storage";

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
  if (stored === "light" || stored === "dark") return stored;
  return null;
}

function getInitialTheme(): ThemeMode {
  if (hasWebStorage()) {
    const stored = readStoredTheme();
    if (stored) return stored;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void ensureStorageHydrated().then(() => {
      const stored = readStoredTheme();
      if (stored) setThemeState(stored);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    setItemSync(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
