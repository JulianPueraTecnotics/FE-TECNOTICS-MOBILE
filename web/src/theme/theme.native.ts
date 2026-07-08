/** Tokens alineados con `index.css` (`:root` y `[data-theme="dark"]`). */
export interface NativeThemeColors {
  primary: string;
  primaryText: string;
  secondary: string;
  accent: string;
  accentHover: string;
  pageBg: string;
  cardBg: string;
  bgSubtle: string;
  textMuted: string;
  border: string;
  headerAccent: string;
  headerAccentHover: string;
  heroOverlay: string;
  statusBarStyle: "light" | "dark";
}

export const nativeThemeColors: Record<"light" | "dark", NativeThemeColors> = {
  light: {
    primary: "#002737",
    primaryText: "#1a1a1a",
    secondary: "#2c5282",
    accent: "#5a9fb4",
    accentHover: "#4a8fa4",
    pageBg: "#ffffff",
    cardBg: "#ffffff",
    bgSubtle: "#f7fafc",
    textMuted: "#4a5568",
    border: "#d1d5db",
    headerAccent: "#6099ac",
    headerAccentHover: "#4a8496",
    heroOverlay: "rgba(0, 39, 55, 0.5)",
    statusBarStyle: "dark",
  },
  dark: {
    // En modo oscuro los textos e íconos "azul claro" se muestran en blanco.
    primary: "#ffffff",
    primaryText: "#e6edf3",
    secondary: "#ffffff",
    accent: "#5a9fb4",
    accentHover: "#4a8fa4",
    pageBg: "#0d1117",
    cardBg: "#161b22",
    bgSubtle: "#161b22",
    textMuted: "#8b949e",
    border: "#30363d",
    headerAccent: "#6099ac",
    headerAccentHover: "#4a8496",
    heroOverlay: "rgba(13, 17, 23, 0.72)",
    statusBarStyle: "light",
  },
};
