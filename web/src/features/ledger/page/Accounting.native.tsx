import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSearchParams } from "react-router-dom";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { ACCOUNTING_NAV, isAccountingSection, type AccountingSection } from "../accounting.nav";
import {
  BalanceSectionNative,
  CierreSectionNative,
  ComprobantesSectionNative,
  DianExogenaSectionNative,
  DiarioSectionNative,
  EstadosSectionNative,
  MayorSectionNative,
  PeriodosSectionNative,
  SaldosSectionNative,
} from "./ledgerSections.native";

function SectionBody({ section }: { section: AccountingSection }) {
  switch (section) {
    case "comprobantes":
      return <ComprobantesSectionNative />;
    case "diario":
      return <DiarioSectionNative />;
    case "mayor":
      return <MayorSectionNative />;
    case "balance":
      return <BalanceSectionNative />;
    case "estados":
      return <EstadosSectionNative />;
    case "saldos":
      return <SaldosSectionNative />;
    case "cierre":
      return <CierreSectionNative />;
    case "periodos":
      return <PeriodosSectionNative />;
    case "dian":
      return <DianExogenaSectionNative />;
    default:
      return null;
  }
}

export default function AccountingNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("sec");
  const [section, setSection] = useState<AccountingSection>(
    isAccountingSection(initial) ? initial : "comprobantes"
  );

  const go = (s: AccountingSection) => {
    setSection(s);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("sec", s);
      return p;
    });
  };

  const groups = [...new Set(ACCOUNTING_NAV.map((n) => n.group))];

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Contabilidad</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Comprobantes, libros, estados financieros y DIAN
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabsContent}
      >
        {ACCOUNTING_NAV.map((item) => {
          const active = section === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => go(item.key)}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: colors.bgSubtle, borderColor: colors.accent }
                  : { borderColor: "transparent" },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.primary : colors.textMuted },
                  active ? styles.tabTextActive : null,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.paddingBottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.groupHint, { color: colors.textMuted }]}>
          {groups.find((g) => ACCOUNTING_NAV.some((n) => n.group === g && n.key === section))}
        </Text>
        <SectionBody section={section} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 4 },
  tabsScroll: { maxHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  tabsContent: { paddingHorizontal: 12, alignItems: "center", gap: 6 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    marginVertical: 6,
  },
  tabText: { fontSize: 13, fontWeight: "500" },
  tabTextActive: { fontWeight: "700" },
  content: { paddingTop: 10, paddingHorizontal: 16 },
  groupHint: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
});
