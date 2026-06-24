import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../mobile/shellStyles.native";

type Props = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
  hint?: string;
  negative?: boolean;
};

export default function AnalyticsKpiNative({
  label,
  value,
  icon,
  accent = "#3b82f6",
  hint,
  negative,
}: Props) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        getSoftCardShadow(colors),
        { backgroundColor: colors.cardBg, borderColor: colors.border, borderTopColor: accent, borderTopWidth: 3 },
      ]}
    >
      <View style={styles.top}>
        {icon ? <Ionicons name={icon} size={16} color={accent} /> : null}
        <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, { color: negative ? "#dc2626" : colors.primaryText }]}>{value}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.menuItem,
    padding: 12,
    marginBottom: 10,
    minHeight: 88,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: "600", flex: 1 },
  value: { fontSize: 18, fontWeight: "800" },
  hint: { fontSize: 11, marginTop: 4 },
});
