import type { NativeThemeColors } from "../../theme/theme.native";

/** Bordes y sombras estilo ACTIVA adaptados a tokens Tecnotics. */
export function getShellBorder(theme: NativeThemeColors) {
  return theme.border;
}

export function getHeaderShadow(theme: NativeThemeColors) {
  return {
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  };
}

export function getSoftCardShadow(theme: NativeThemeColors) {
  return {
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.08,
    shadowRadius: 7,
    elevation: 2,
  };
}

export function getDrawerShadow() {
  return {
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 } as const,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  };
}

export const SHELL_RADIUS = {
  button: 8,
  menuItem: 8,
  input: 8,
  card: 12,
  container: 12,
  social: 12,
} as const;

/** Espaciado alineado con design-system web (ds-page, ds-container). */
export const DS_SPACE = {
  page: 16,
  container: 16,
  section: 12,
  gap: 8,
} as const;
