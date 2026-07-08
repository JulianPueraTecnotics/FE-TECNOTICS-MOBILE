import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import DsField from "../../design-system-native/DsField.native";

export function LedgerCard({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

export function LedgerSectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sectionSub, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function LedgerLoading() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="small" />
    </View>
  );
}

export function LedgerEmpty({ text }: { text: string }) {
  const colors = useThemeColors();
  return <Text style={[styles.empty, { color: colors.textMuted }]}>{text}</Text>;
}

export function LedgerRow({
  cells,
  onPress,
}: {
  cells: { label?: string; value: string; bold?: boolean; align?: "left" | "right" }[];
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const content = (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      {cells.map((c, i) => (
        <View key={i} style={[styles.cell, c.align === "right" ? styles.cellRight : null]}>
          {c.label ? <Text style={[styles.cellLabel, { color: colors.textMuted }]}>{c.label}</Text> : null}
          <Text
            style={[
              styles.cellValue,
              { color: colors.primaryText },
              c.bold ? styles.cellBold : null,
              c.align === "right" ? styles.textRight : null,
            ]}
            numberOfLines={2}
          >
            {c.value}
          </Text>
        </View>
      ))}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function LedgerChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? colors.headerAccent : colors.border,
          backgroundColor: active ? colors.headerAccent : colors.cardBg,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? "#fff" : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

export function LedgerChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

export function LedgerField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  multiline?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  // Delegamos en DsField para tener el estilo del portal (campo con ícono).
  const resolvedIcon =
    icon ?? (keyboardType === "numeric" || keyboardType === "decimal-pad"
      ? "calculator-outline"
      : multiline
        ? "document-text-outline"
        : "create-outline");
  return (
    <View style={styles.field}>
      <DsField
        label={label}
        icon={resolvedIcon}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

export function LedgerPrimaryBtn({
  label,
  onPress,
  disabled,
  loading,
  icon,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "secondary" | "danger";
}) {
  const colors = useThemeColors();
  const bg =
    variant === "danger" ? "#dc2626" : variant === "secondary" ? colors.cardBg : colors.headerAccent;
  const fg = variant === "secondary" ? colors.primaryText : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled || loading ? 0.5 : 1 },
        variant === "secondary" ? { borderWidth: 1, borderColor: colors.border } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function LedgerStatusBadge({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "neutral" }) {
  const bg =
    tone === "ok" ? "#dcfce7" : tone === "warn" ? "#fef9c3" : tone === "bad" ? "#fee2e2" : "#f1f5f9";
  const fg =
    tone === "ok" ? "#166534" : tone === "warn" ? "#854d0e" : tone === "bad" ? "#991b1b" : "#475569";
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function DateRangeBar({
  desde,
  hasta,
  onDesde,
  onHasta,
}: {
  desde: string;
  hasta: string;
  onDesde: (v: string) => void;
  onHasta: (v: string) => void;
}) {
  return (
    <View style={styles.dateRow}>
      <LedgerField label="Desde" value={desde} onChangeText={onDesde} placeholder="YYYY-MM-DD" />
      <LedgerField label="Hasta" value={hasta} onChangeText={onHasta} placeholder="YYYY-MM-DD" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: SHELL_RADIUS.card,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sectionHead: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  sectionSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  loadingWrap: { paddingVertical: 24, alignItems: "center" },
  empty: { fontSize: 14, paddingVertical: 16, textAlign: "center" },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: { minWidth: "30%", flex: 1 },
  cellRight: { alignItems: "flex-end" },
  cellLabel: { fontSize: 10, marginBottom: 3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  cellValue: { fontSize: 14, lineHeight: 19 },
  cellBold: { fontWeight: "700" },
  textRight: { textAlign: "right" },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  field: { flex: 1, minWidth: 120 },
  fieldLabel: { fontSize: 12, marginBottom: 4, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.input,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: SHELL_RADIUS.button,
  },
  btnText: { fontSize: 14, fontWeight: "600" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  dateRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
});
