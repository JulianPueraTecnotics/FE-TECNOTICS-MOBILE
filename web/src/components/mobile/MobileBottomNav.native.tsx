import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../store/auth.context";
import { PATHS } from "../../router/paths.contants";
import { useThemeColors } from "../../theme/useThemeColors";
import { BOTTOM_NAV_HEIGHT } from "./nativeShell.constants";

type Props = {
  onOpenMenu: () => void;
};

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
      <Ionicons name={icon} size={22} color={active ? colors.accent : colors.textMuted} />
      <Text
        style={[
          styles.tabLabel,
          { color: active ? colors.accent : colors.textMuted },
          active ? styles.tabLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function MobileBottomNav({ onOpenMenu }: Props) {
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
        <BottomTab label="Menú" icon="menu-outline" active={false} onPress={onOpenMenu} />
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
      <BottomTab label="Más" icon="menu-outline" active={false} onPress={onOpenMenu} />
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
    gap: 2,
    minHeight: 44,
  },
  tabLabel: { fontSize: 10, fontWeight: "500" },
  tabLabelActive: { fontWeight: "700" },
});
