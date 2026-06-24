import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../mobile/shellStyles.native";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function AnalyticsSectionNative({ title, subtitle, children }: Props) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.wrap,
        getSoftCardShadow(colors),
        { backgroundColor: colors.cardBg, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function AnalyticsRow({
  left,
  right,
  muted,
}: {
  left: string;
  right: string;
  muted?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLeft, { color: muted ? colors.textMuted : colors.primaryText }]} numberOfLines={2}>
        {left}
      </Text>
      <Text style={[styles.rowRight, { color: colors.primaryText, fontWeight: muted ? "400" : "600" }]}>{right}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.menuItem,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  sub: { fontSize: 12, marginBottom: 10, lineHeight: 18 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flex: 1, fontSize: 13 },
  rowRight: { fontSize: 13, textAlign: "right" },
});
