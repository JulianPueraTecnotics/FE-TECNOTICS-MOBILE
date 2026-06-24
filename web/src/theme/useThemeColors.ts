import { useTheme } from "../store/theme.context";
import { nativeThemeColors, type NativeThemeColors } from "./theme.native";

export function useThemeColors(): NativeThemeColors {
  const { theme } = useTheme();
  return nativeThemeColors[theme];
}
