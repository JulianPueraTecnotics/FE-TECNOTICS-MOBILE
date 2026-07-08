import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSearchParams } from "react-router-dom";
import { DsModuleScreen } from "../../../components/design-system-native";
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
import {
  AdjustmentsSectionNative,
  BudgetSectionNative,
  FiscalSectionNative,
  IcaSectionNative,
  IntegritySectionNative,
  NotesSectionNative,
  ThirdPartySectionNative,
} from "./ledgerExtendedSections.native";

function SectionBody({ section }: { section: AccountingSection }) {
  switch (section) {
    case "comprobantes":
      return <ComprobantesSectionNative />;
    case "diario":
      return <DiarioSectionNative />;
    case "mayor":
      return <MayorSectionNative />;
    case "terceros":
      return <ThirdPartySectionNative />;
    case "balance":
      return <BalanceSectionNative />;
    case "estados":
      return <EstadosSectionNative />;
    case "notas":
      return <NotesSectionNative />;
    case "presupuesto":
      return <BudgetSectionNative />;
    case "fiscal":
      return <FiscalSectionNative />;
    case "ajustes":
      return <AdjustmentsSectionNative />;
    case "saldos":
      return <SaldosSectionNative />;
    case "cierre":
      return <CierreSectionNative />;
    case "periodos":
      return <PeriodosSectionNative />;
    case "salud":
      return <IntegritySectionNative />;
    case "dian":
      return <DianExogenaSectionNative />;
    case "ica":
      return <IcaSectionNative />;
    default:
      return null;
  }
}

export default function AccountingNative() {
  const colors = useThemeColors();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("sec");
  const [section, setSection] = useState<AccountingSection>(
    isAccountingSection(initial) ? initial : "comprobantes"
  );

  // Sincroniza la pestaña activa cuando se navega desde el menú lateral (cambia ?sec=).
  useEffect(() => {
    const sec = searchParams.get("sec");
    if (isAccountingSection(sec)) {
      setSection((prev) => (prev === sec ? prev : sec));
    }
  }, [searchParams]);

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
    <DsModuleScreen
      title="Contabilidad"
      subtitle="Comprobantes, libros, estados financieros y DIAN"
      noScroll
    >
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
                  ? { backgroundColor: colors.headerAccent, borderColor: colors.headerAccent }
                  : { borderColor: "transparent" },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? "#fff" : colors.textMuted },
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
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.groupHint, { color: colors.textMuted }]}>
          {groups.find((g) => ACCOUNTING_NAV.some((n) => n.group === g && n.key === section))}
        </Text>
        <SectionBody section={section} />
      </ScrollView>
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  tabsScroll: { flexGrow: 0, height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: "center" },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    marginRight: 8,
  },
  tabText: { fontSize: 13, fontWeight: "500" },
  tabTextActive: { fontWeight: "700" },
  content: { padding: 16, paddingBottom: 32 },
  groupHint: { fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
});
