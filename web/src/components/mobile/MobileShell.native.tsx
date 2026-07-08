import { useContext, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocation, useNavigate } from "react-router-dom";
import AccentStrip from "./AccentStrip.native";
import PublicMobileDrawer from "./PublicMobileDrawer.native";
import MobileAuthenticatedHeader from "./MobileAuthenticatedHeader.native";
import MobilePrivateDrawer from "./MobilePrivateDrawer.native";
import MobileBottomNav from "./MobileBottomNav.native";
import { PUBLIC_HEADER_HEIGHT } from "./publicShell.constants";
import { getHeaderShadow, SHELL_RADIUS } from "./shellStyles.native";
import HeaderBrand from "../shared/HeaderBrand.native";
import ThemeSwitch from "../shared/ThemeSwitch.native";
import { PATHS } from "../../router/paths.contants";
import { AuthContext } from "../../store/auth.context";
import { useThemeColors } from "../../theme/useThemeColors";

const AUTH_PATHS = [PATHS.LOGIN, PATHS.REGISTER, PATHS.FORGOT_PASSWORD];
const PUBLIC_NO_SHELL = [PATHS.QUOTE_PUBLIC, PATHS.REMISION_PUBLIC];

function isPublicNoShellPath(pathname: string): boolean {
  if (pathname.startsWith("/cot/public/")) return true;
  if (pathname.startsWith("/remision/firmar/")) return true;
  if (pathname.startsWith("/continue/mandato/")) return true;
  return PUBLIC_NO_SHELL.some((p) => pathname === p);
}

const MobileShell: React.FC = () => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pathname = location.pathname;
  const isAuthPage = AUTH_PATHS.includes(pathname);
  const isPublicHome = pathname === PATHS.HOME;
  const isPublicNoShell = isPublicNoShellPath(pathname);
  const isSuperAdmin = user?.role === "super_admin";
  const homePath = isSuperAdmin ? PATHS.ADMIN_HOME : PATHS.DASHBOARD;

  const showPublicShell = (isPublicHome || isAuthPage) && !isPublicNoShell;
  const showPrivateShell = Boolean(user && !isPublicHome && !isAuthPage && !isPublicNoShell);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (user && isAuthPage) {
      navigate(homePath, { replace: true });
    }
  }, [user, isAuthPage, navigate, homePath]);

  if (isPublicNoShell) return null;

  if (showPrivateShell) {
    return (
      <>
        <MobileAuthenticatedHeader onOpenMenu={() => setDrawerOpen(true)} />
        <MobilePrivateDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <MobileBottomNav />
      </>
    );
  }

  if (!showPublicShell) return null;

  const headerTotalHeight = insets.top + PUBLIC_HEADER_HEIGHT;
  const headerShadow = getHeaderShadow(colors);

  return (
    <>
      <View
        style={[
          styles.header,
          headerShadow,
          {
            paddingTop: insets.top,
            paddingLeft: Math.max(8, insets.left),
            paddingRight: Math.max(12, insets.right),
            height: headerTotalHeight,
            backgroundColor: colors.pageBg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <HeaderBrand onPress={() => navigate(PATHS.HOME)} />
        </View>

        <View style={styles.headerRight}>
          <ThemeSwitch />
          <Pressable
            style={[
              styles.menuBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.cardBg,
              },
            ]}
            onPress={() => setDrawerOpen(true)}
            accessibilityLabel="Abrir menú"
          >
            <Text style={[styles.menuIcon, { color: colors.primaryText }]}>☰</Text>
          </Pressable>
        </View>

        <View style={styles.accentWrap}>
          <AccentStrip height={2} opacity={0.75} />
        </View>
      </View>

      <View style={{ height: headerTotalHeight, backgroundColor: colors.pageBg }} />

      <PublicMobileDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  accentWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    alignSelf: "stretch",
    minWidth: 0,
    marginRight: 8,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
  menuBtn: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: { fontSize: 24, lineHeight: 26, fontWeight: "700" },
});

export default MobileShell;
