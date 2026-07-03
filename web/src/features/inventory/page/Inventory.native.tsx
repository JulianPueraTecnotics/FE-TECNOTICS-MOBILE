import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSearchParams } from "react-router-dom";
import { DsModuleScreen } from "../../../components/design-system-native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { INVENTORY_NAV, isInventorySection, type InventorySection } from "../inventory.nav";
import ExistenciasNative from "./Existencias.native";
import KardexNative from "./Kardex.native";
import ValorizadoNative from "./Valorizado.native";
import BodegasNative from "./Bodegas.native";
import AjustesNative from "./Ajustes.native";
import TrasladosNative from "./Traslados.native";
import SaldosInicialesNative from "./SaldosIniciales.native";
function SectionBody({ section }: { section: InventorySection }) {
  switch (section) {
    case "existencias":
      return <ExistenciasNative />;
    case "kardex":
      return <KardexNative />;
    case "valorizado":
      return <ValorizadoNative />;
    case "bodegas":
      return <BodegasNative />;
    case "ajustes":
      return <AjustesNative />;
    case "traslados":
      return <TrasladosNative />;
    case "saldos":
      return <SaldosInicialesNative />;
    default:
      return null;
  }
}

export default function InventoryNative() {
  const colors = useThemeColors();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("sec");
  const [section, setSection] = useState<InventorySection>(
    isInventorySection(initial) ? initial : "existencias",
  );

  const pickSection = (key: InventorySection) => {
    setSection(key);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("sec", key);
      return p;
    });
  };

  const current = INVENTORY_NAV.find((n) => n.key === section);

  return (
    <DsModuleScreen
      title={current?.label ?? "Inventario"}
      subtitle="Existencias, kardex y bodegas"
      noScroll
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
        contentContainerStyle={styles.tabs}
      >
        {INVENTORY_NAV.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => pickSection(tab.key)}
            style={[
              styles.tab,
              section === tab.key
                ? { backgroundColor: colors.headerAccent }
                : { borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <Ionicons name={tab.icon} size={14} color={section === tab.key ? "#fff" : colors.primaryText} />
            <Text style={{ color: section === tab.key ? "#fff" : colors.primaryText, fontSize: 12, fontWeight: "600" }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>
        <SectionBody section={section} />
      </View>    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, marginRight: 8 },
});
