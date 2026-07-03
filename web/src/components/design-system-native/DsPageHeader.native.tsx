import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DS_SPACE } from "../mobile/shellStyles.native";
import { useThemeColors } from "../../theme/useThemeColors";
import { DS_HEADER_ACCENT_HEIGHT, DS_TYPO } from "./tokens.native";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

/** Cabecera de módulo — paridad con `.ds-header` / `.documents-header` del portal. */
export default function DsPageHeader({ title, subtitle, actions }: Props) {
  const colors = useThemeColors();

  return (
    <View style={[styles.wrap, { backgroundColor: colors.pageBg, borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      <View style={[styles.accent, { backgroundColor: colors.headerAccent, height: DS_HEADER_ACCENT_HEIGHT }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: DS_SPACE.page,
    paddingTop: 12,
    paddingBottom: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 10,
  },
  textCol: { flex: 1 },
  title: DS_TYPO.pageTitle,
  subtitle: { ...DS_TYPO.pageSubtitle, marginTop: 4 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  accent: { marginHorizontal: -DS_SPACE.page, marginBottom: 0 },
});
