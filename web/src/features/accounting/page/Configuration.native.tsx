import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSearchParams } from "react-router-dom";
import { DsModuleScreen } from "../../../components/design-system-native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import ProfilePage from "../../profile/page/Profile.native";
import SubUsersPage from "../../sub-users/page/SubUsers.native";
import ConfigurationAccounting from "./ConfigurationAccounting.native";
import {
  CONFIGURATION_NAV,
  isConfigurationSection,
  type ConfigurationSection,
} from "./configuration.nav";

const PROFILE_SECTIONS = new Set<ConfigurationSection>(["facturacion", "documentos", "eventos"]);
const ACCOUNTING_SECTIONS = new Set<ConfigurationSection>([
  "cuentas",
  "consecutivos",
  "centros",
  "puc",
  "impuestos",
  "perfil_tributario",
  "roles",
  "auditoria",
]);

const SECTION_TO_PROFILE: Record<string, "billing-config" | "documents" | "events"> = {
  facturacion: "billing-config",
  documentos: "documents",
  eventos: "events",
};

export default function ConfigurationNative() {
  const colors = useThemeColors();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("sec");
  const [section, setSection] = useState<ConfigurationSection>(
    isConfigurationSection(initial) ? initial : "facturacion"
  );

  // Sincroniza la pestaña activa cuando se navega desde el menú lateral (cambia ?sec=).
  useEffect(() => {
    const sec = searchParams.get("sec");
    if (isConfigurationSection(sec)) {
      setSection((prev) => (prev === sec ? prev : sec));
    }
  }, [searchParams]);

  const go = (s: ConfigurationSection) => {
    setSection(s);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("sec", s);
      return p;
    });
  };

  return (
    <DsModuleScreen
      title="Configuración"
      subtitle="Misma estructura que el portal — facturación, usuarios y contabilidad"
      noScroll
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabsContent}
      >
        {CONFIGURATION_NAV.map((item) => {
          const active = section === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => go(item.key)}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: colors.headerAccent, borderColor: colors.headerAccent }
                  : { borderColor: colors.border },
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

      <View style={{ flex: 1 }}>
        {PROFILE_SECTIONS.has(section) ? (
          <ProfilePage
            mode="configuration"
            embedded
            initialSection={SECTION_TO_PROFILE[section]}
          />
        ) : section === "usuarios" ? (
          <SubUsersPage />
        ) : ACCOUNTING_SECTIONS.has(section) ? (
          <ConfigurationAccounting section={section} />
        ) : null}
      </View>
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
});
