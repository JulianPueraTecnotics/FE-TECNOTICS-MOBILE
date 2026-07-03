import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { SHELL_RADIUS } from "../mobile/shellStyles.native";
import { useThemeColors } from "../../theme/useThemeColors";
import { DS_TYPO } from "./tokens.native";

type IonName = keyof typeof Ionicons.glyphMap;

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: IonName;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  style?: ViewStyle;
};

/** Botón — paridad con `.ds-btn-primary` / `.ds-btn-secondary`. */
export default function DsButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  compact,
  style,
}: Props) {
  const colors = useThemeColors();
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  const bg = isDanger ? "#dc2626" : isPrimary ? colors.headerAccent : colors.cardBg;
  const fg = isPrimary || isDanger ? "#fff" : colors.primaryText;
  const borderColor = isPrimary || isDanger ? "transparent" : colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        compact ? styles.btnCompact : null,
        {
          backgroundColor: bg,
          borderColor,
          opacity: disabled || loading ? 0.55 : pressed ? 0.88 : 1,
        },
        !isPrimary && !isDanger ? { borderWidth: 1 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
          {label ? <Text style={[styles.label, { color: fg }]}>{label}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: SHELL_RADIUS.button,
    minHeight: 44,
  },
  btnCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  label: DS_TYPO.btn,
});
