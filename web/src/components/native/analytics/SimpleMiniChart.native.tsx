import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/useThemeColors";

type BarSeries = { label: string; value: number; color: string };

type GroupedBarProps = {
  groups: { label: string; series: BarSeries[] }[];
  formatValue?: (n: number) => string;
  emptyLabel?: string;
};

/** Barras agrupadas simples (sin dependencias de gráficos). */
export function SimpleGroupedBarChart({ groups, formatValue, emptyLabel }: GroupedBarProps) {
  const colors = useThemeColors();
  const fmt = formatValue ?? ((n: number) => String(Math.round(n)));

  if (!groups.length || groups.every((g) => g.series.every((s) => !s.value))) {
    return <Text style={[styles.empty, { color: colors.textMuted }]}>{emptyLabel ?? "Sin datos."}</Text>;
  }

  const max = Math.max(...groups.flatMap((g) => g.series.map((s) => s.value)), 1);

  return (
    <View style={styles.wrap}>
      {groups.map((group) => (
        <View key={group.label} style={styles.group}>
          <Text style={[styles.groupLabel, { color: colors.textMuted }]} numberOfLines={1}>
            {group.label}
          </Text>
          <View style={styles.barsRow}>
            {group.series.map((s) => (
              <View key={s.label} style={styles.barCol}>
                <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: s.color,
                        height: `${Math.max(4, (s.value / max) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barValue, { color: colors.primaryText }]} numberOfLines={1}>
                  {fmt(s.value)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

type StackedProps = {
  segments: { label: string; value: number; color: string }[];
  formatValue?: (n: number) => string;
  emptyLabel?: string;
};

/** Barra apilada horizontal para liquidez. */
export function SimpleStackedBarChart({ segments, formatValue, emptyLabel }: StackedProps) {
  const colors = useThemeColors();
  const fmt = formatValue ?? ((n: number) => String(Math.round(n)));
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);

  if (total <= 0) {
    return <Text style={[styles.empty, { color: colors.textMuted }]}>{emptyLabel ?? "Sin datos."}</Text>;
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.stackedTrack, { backgroundColor: colors.border }]}>
        {segments.map((seg) => {
          const pct = (Math.max(0, seg.value) / total) * 100;
          if (pct <= 0) return null;
          return (
            <View
              key={seg.label}
              style={[styles.stackedSeg, { width: `${pct}%`, backgroundColor: seg.color }]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        {segments.map((seg) => (
          <View key={seg.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>
              {seg.label}: <Text style={{ color: colors.primaryText, fontWeight: "600" }}>{fmt(seg.value)}</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  const colors = useThemeColors();
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: item.color }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  empty: { fontSize: 13, lineHeight: 20, paddingVertical: 8 },
  group: { marginBottom: 12 },
  groupLabel: { fontSize: 11, marginBottom: 6, fontWeight: "600" },
  barsRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: { width: "100%", height: 72, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 4, minHeight: 4 },
  barValue: { fontSize: 10, fontWeight: "600" },
  stackedTrack: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden" },
  stackedSeg: { height: "100%" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
});
