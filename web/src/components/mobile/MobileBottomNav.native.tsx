import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../store/auth.context";
import { PATHS } from "../../router/paths.contants";
import { useThemeColors } from "../../theme/useThemeColors";
import TecAvatar from "../../assets/Tec_asistente.png";
import { openTec } from "../../features/tec/tec-open-store";
import { BOTTOM_NAV_HEIGHT } from "./nativeShell.constants";
import { getSoftCardShadow } from "./shellStyles.native";

const VENTAS_PREFIXES = [
  PATHS.DOCUMENTS,
  PATHS.SALES_RECAUDOS,
  PATHS.SALES_COTIZACIONES,
  PATHS.SALES_COTIZACIONES_NUEVA,
  PATHS.SALES_REMISIONES,
  PATHS.SALES_PLANTILLAS,
  PATHS.CLIENTS,
];

const COMPRAS_PREFIXES = [
  PATHS.PURCHASES,
  PATHS.PURCHASES_SUPPLIERS,
  PATHS.PURCHASES_COMPRAS,
  PATHS.PURCHASES_GASTOS,
  PATHS.PURCHASES_PARAM,
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type TabProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
};

function BottomTab({ label, icon, active, onPress }: TabProps) {
  const colors = useThemeColors();
  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="button">
      <View
        style={[
          styles.tabInner,
          active ? { backgroundColor: colors.headerAccent } : null,
        ]}
      >
        <Ionicons name={icon} size={22} color={active ? "#fff" : colors.textMuted} />
        <Text
          style={[
            styles.tabLabel,
            { color: active ? "#fff" : colors.textMuted },
            active ? styles.tabLabelActive : null,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function TecCenterButton() {
  const colors = useThemeColors();
  return (
    <View style={styles.centerSlot}>
      <Pressable
        onPress={openTec}
        accessibilityRole="button"
        accessibilityLabel="Abrir asistente TEC"
        style={[
          styles.tecBtn,
          getSoftCardShadow(colors),
          { backgroundColor: "#fff", borderColor: colors.headerAccent },
        ]}
      >
        <Image source={TecAvatar} style={styles.tecAvatar} />
      </Pressable>
      <Text style={[styles.tecLabel, { color: colors.textMuted }]}>TEC</Text>
    </View>
  );
}

export default function MobileBottomNav() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const pathname = location.pathname;
  const isSuperAdmin = user?.role === "super_admin";

  if (isSuperAdmin) {
    return (
      <View
        style={[
          styles.bar,
          {
            paddingBottom: insets.bottom,
            height: BOTTOM_NAV_HEIGHT + insets.bottom,
            backgroundColor: colors.cardBg,
            borderTopColor: colors.border,
          },
        ]}
      >
        <BottomTab
          label="Empresas"
          icon="business-outline"
          active={pathname === PATHS.ADMIN_HOME}
          onPress={() => navigate(PATHS.ADMIN_HOME)}
        />
        <BottomTab
          label="Planes"
          icon="pricetag-outline"
          active={pathname === PATHS.ADMIN_PLANS}
          onPress={() => navigate(PATHS.ADMIN_PLANS)}
        />
        <BottomTab
          label="Admins"
          icon="shield-outline"
          active={pathname === PATHS.ADMIN_ADMINS}
          onPress={() => navigate(PATHS.ADMIN_ADMINS)}
        />
      </View>
    );
  }

  const ventasActive =
    matchesPrefix(pathname, VENTAS_PREFIXES) || pathname.startsWith("/ventas/cotizaciones/");
  const comprasActive = matchesPrefix(pathname, COMPRAS_PREFIXES);
  const contabActive =
    pathname.startsWith(PATHS.ACCOUNTING) || pathname.startsWith(PATHS.FIXED_ASSETS);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom,
          height: BOTTOM_NAV_HEIGHT + insets.bottom,
          backgroundColor: colors.cardBg,
          borderTopColor: colors.border,
        },
      ]}
    >
      <BottomTab
        label="Inicio"
        icon="home-outline"
        active={pathname === PATHS.DASHBOARD}
        onPress={() => navigate(PATHS.DASHBOARD)}
      />
      <BottomTab
        label="Ventas"
        icon="cart-outline"
        active={ventasActive}
        onPress={() => navigate(PATHS.DOCUMENTS)}
      />
      <TecCenterButton />
      <BottomTab
        label="Compras"
        icon="bag-outline"
        active={comprasActive}
        onPress={() => navigate(PATHS.PURCHASES_COMPRAS)}
      />
      <BottomTab
        label="Contab."
        icon="book-outline"
        active={contabActive}
        onPress={() => navigate(PATHS.ACCOUNTING)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 52,
  },
  tabLabel: { fontSize: 10, fontWeight: "500" },
  tabLabelActive: { fontWeight: "700" },
  centerSlot: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  tecBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
  },
  tecAvatar: { width: 48, height: 48, borderRadius: 24 },
  tecLabel: { fontSize: 10, fontWeight: "700", marginTop: 2 },
});
