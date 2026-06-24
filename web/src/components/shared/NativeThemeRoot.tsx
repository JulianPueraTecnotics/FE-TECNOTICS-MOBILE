import { View, StyleSheet } from "react-native";
import { Platform } from "react-native";
import { useThemeColors } from "../../theme/useThemeColors";

/** Fondo raíz en nativo — en web el tema lo aplica `data-theme` en CSS. */
export function NativeThemeRoot({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();

  if (Platform.OS === "web") {
    return <>{children}</>;
  }

  return <View style={[styles.root, { backgroundColor: colors.pageBg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
