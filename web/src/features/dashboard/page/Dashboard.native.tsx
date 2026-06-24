import { Ionicons } from "@expo/vector-icons";
import { useContext, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { PATHS } from "../../../router/paths.contants";
import { AuthContext } from "../../../store/auth.context";
import { useThemeColors } from "../../../theme/useThemeColors";
import { parseBillingNavigateState } from "../../billing/billing.types";
import BillingNativeScreen from "../../billing/BillingNativeScreen.native";

type Tab = "inicio" | "facturar";

const QUICK_LINKS = [
  { label: "Facturas", icon: "document-text-outline" as const, path: PATHS.DOCUMENTS },
  { label: "Clientes", icon: "people-outline" as const, path: PATHS.CLIENTS },
  { label: "Cotizaciones", icon: "create-outline" as const, path: PATHS.SALES_COTIZACIONES },
  { label: "Recaudos", icon: "cash-outline" as const, path: PATHS.SALES_RECAUDOS },
  { label: "Remisiones", icon: "car-outline" as const, path: PATHS.SALES_REMISIONES },
  { label: "Plantillas", icon: "copy-outline" as const, path: PATHS.SALES_PLANTILLAS },
  { label: "Productos", icon: "cube-outline" as const, path: PATHS.PRODUCTS_SERVICES },
  { label: "Terceros", icon: "id-card-outline" as const, path: PATHS.TERCEROS },
  { label: "Configuración", icon: "settings-outline" as const, path: PATHS.CONFIGURATION },
  { label: "Mi perfil", icon: "person-circle-outline" as const, path: PATHS.MY_PROFILE },
];

export default function DashboardNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const recreateId = parseBillingNavigateState(location.state).recreateFacturaId;
  const [tab, setTab] = useState<Tab>(() => (recreateId ? "facturar" : "inicio"));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.pageBg },
        tabs: {
          flexDirection: "row",
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 4,
          borderRadius: SHELL_RADIUS.input,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        tab: { flex: 1, paddingVertical: 10, alignItems: "center" },
        tabActive: { backgroundColor: colors.accent },
        tabText: { fontWeight: "600", color: colors.primaryText },
        tabTextActive: { color: "#fff" },
        welcome: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
        welcomeTitle: { fontSize: 20, fontWeight: "700", color: colors.primary },
        welcomeSub: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
        grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
        tile: {
          width: "47%",
          borderWidth: 1,
          borderRadius: SHELL_RADIUS.card,
          padding: 14,
          alignItems: "flex-start",
          gap: 8,
        },
        tileLabel: { fontWeight: "600", color: colors.primaryText, fontSize: 14 },
        facturarCta: {
          marginHorizontal: 16,
          marginTop: 8,
          marginBottom: 16,
          backgroundColor: colors.accent,
          borderRadius: SHELL_RADIUS.button,
          paddingVertical: 14,
          alignItems: "center",
        },
        facturarCtaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
      }),
    [colors],
  );

  if (tab === "facturar") {
    return (
      <View style={styles.root}>
        <View style={[styles.tabs, { marginBottom: 0 }]}>
          <Pressable style={styles.tab} onPress={() => setTab("inicio")}>
            <Text style={styles.tabText}>Inicio</Text>
          </Pressable>
          <Pressable style={[styles.tab, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Facturar</Text>
          </Pressable>
        </View>
        <BillingNativeScreen variant="dashboard" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.paddingBottom + 24 }}>
        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>Hola{user?.razon_social ? `, ${user.razon_social}` : ""}</Text>
          <Text style={styles.welcomeSub}>Accesos rápidos a ventas, catálogo y configuración</Text>
        </View>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Inicio</Text>
          </Pressable>
          <Pressable style={styles.tab} onPress={() => setTab("facturar")}>
            <Text style={styles.tabText}>Facturar</Text>
          </Pressable>
        </View>

        <Pressable style={styles.facturarCta} onPress={() => setTab("facturar")}>
          <Text style={styles.facturarCtaText}>Nueva factura</Text>
        </Pressable>

        <View style={styles.grid}>
          {QUICK_LINKS.map((link) => (
            <Pressable
              key={link.path}
              onPress={() => navigate(link.path)}
              style={[styles.tile, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Ionicons name={link.icon} size={22} color={colors.accent} />
              <Text style={styles.tileLabel}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
