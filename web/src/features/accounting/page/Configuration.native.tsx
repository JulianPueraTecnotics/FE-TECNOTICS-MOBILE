import { Suspense, lazy, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSearchParams } from "react-router-dom";
import LoadingScreen from "../../../router/LoadingScreen";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import NativeModuleScreen from "../../../components/native/NativeModuleScreen.native";
import {
  CONFIGURATION_NAV,
  isConfigurationSection,
  type ConfigurationSection,
} from "./configuration.nav";

const ProfilePage = lazy(() => import("../../profile/page/Profile.native"));

const PROFILE_SECTIONS = new Set<ConfigurationSection>(["facturacion", "documentos", "eventos"]);

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

  const go = (s: ConfigurationSection) => {
    setSection(s);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("sec", s);
      return p;
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Configuración</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Misma estructura que el portal — facturación, usuarios y contabilidad
        </Text>
      </View>

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

      <View style={{ flex: 1 }}>
        {PROFILE_SECTIONS.has(section) ? (
          <Suspense fallback={<LoadingScreen />}>
            <ProfilePage
              mode="configuration"
              embedded
              initialSection={SECTION_TO_PROFILE[section]}
            />
          </Suspense>
        ) : section === "usuarios" ? (
          <Suspense fallback={<LoadingScreen />}>
            <NativeModuleScreen overridePath="/sub-usuarios" />
          </Suspense>
        ) : (
          <NativeModuleScreen
            overrideTitle={CONFIGURATION_NAV.find((n) => n.key === section)?.label}
            overrideDescription={`Sección de configuración contable: ${CONFIGURATION_NAV.find((n) => n.key === section)?.label}. Conectada al mismo backend del portal.`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  tabsScroll: { maxHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
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
