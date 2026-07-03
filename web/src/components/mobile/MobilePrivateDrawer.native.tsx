import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigate } from "react-router-dom";
import AccentStrip from "./AccentStrip.native";
import NativeNavMenu from "./NativeNavMenu.native";
import { getDrawerShadow, SHELL_RADIUS } from "./shellStyles.native";
import ThemeBrandLogo from "../shared/ThemeBrandLogo.native";
import ThemeSwitch from "../shared/ThemeSwitch.native";
import { PATHS } from "../../router/paths.contants";
import { AuthContext } from "../../store/auth.context";
import { canAccessPath, getHomePathForRole, getPathnameFromRoute } from "../../router/routeAccess";
import { useThemeColors } from "../../theme/useThemeColors";
import { logoutService } from "../../services/auth.service";
import { successToast } from "../shared/toast/toasts";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const DRAWER_WIDTH = Math.min(Dimensions.get("window").width * 0.88, 340);

export default function MobilePrivateDrawer({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const navigate = useNavigate();
  const { user, setUser } = useContext(AuthContext);
  const slideX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const drawerShadow = getDrawerShadow();
  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (!visible) return;
    slideX.setValue(DRAWER_WIDTH);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible, slideX]);

  const go = (path: string) => {
    onClose();
    const pathname = getPathnameFromRoute(path);
    if (!canAccessPath(user?.role ?? null, pathname)) {
      navigate(getHomePathForRole(user?.role ?? null));
      return;
    }
    const [base, query] = path.split("?");
    if (query) {
      navigate({ pathname: base, search: `?${query}` });
      return;
    }
    navigate(path);
  };

  const handleLogout = async () => {
    onClose();
    try {
      await logoutService();
      successToast("Sesión cerrada exitosamente");
    } catch {
      // Cierra sesión local aunque falle el servidor
    } finally {
      setUser(null);
      navigate(PATHS.LOGIN);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Cerrar menú" />
        <Animated.View
          style={[
            styles.drawer,
            drawerShadow,
            {
              width: DRAWER_WIDTH,
              backgroundColor: colors.cardBg,
              borderLeftColor: colors.border,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          <View style={styles.drawerAccent}>
            <AccentStrip height={2} opacity={0.75} />
          </View>

          <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.userBlock}>
              <View style={[styles.avatar, { backgroundColor: colors.bgSubtle }]}>
                <Ionicons name="person" size={22} color={colors.accent} />
              </View>
              <View style={styles.userText}>
                <Text style={[styles.userName, { color: colors.primaryText }]} numberOfLines={2}>
                  {user?.razon_social ?? "Usuario"}
                </Text>
                <Text style={[styles.userRole, { color: colors.textMuted }]}>
                  {isSuperAdmin ? "ADMIN" : user?.role === "company" ? "EMPRESA" : "USUARIO"}
                </Text>
              </View>
            </View>
            <View style={styles.drawerHeaderActions}>
              <ThemeSwitch />
              <Pressable
                onPress={onClose}
                style={[styles.closeBtn, { borderColor: colors.border, backgroundColor: colors.pageBg }]}
              >
                <Text style={[styles.closeText, { color: colors.primaryText }]}>✕</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.navScroll} contentContainerStyle={styles.nav}>
            {isSuperAdmin ? (
              <View style={styles.menuBlock}>
                <Pressable style={styles.link} onPress={() => go(PATHS.ADMIN_HOME)}>
                  <Ionicons name="business-outline" size={20} color={colors.accent} />
                  <Text style={[styles.linkText, { color: colors.primaryText }]}>Empresas</Text>
                </Pressable>
                <Pressable style={styles.link} onPress={() => go(PATHS.ADMIN_PLANS)}>
                  <Ionicons name="pricetag-outline" size={20} color={colors.accent} />
                  <Text style={[styles.linkText, { color: colors.primaryText }]}>Planes</Text>
                </Pressable>
                <Pressable style={styles.link} onPress={() => go(PATHS.ADMIN_ADMINS)}>
                  <Ionicons name="shield-outline" size={20} color={colors.accent} />
                  <Text style={[styles.linkText, { color: colors.primaryText }]}>Administradores</Text>
                </Pressable>
                <Pressable style={styles.link} onPress={() => go(PATHS.ADMIN_CONTADORES)}>
                  <Ionicons name="person-outline" size={20} color={colors.accent} />
                  <Text style={[styles.linkText, { color: colors.primaryText }]}>Contadores</Text>
                </Pressable>
              </View>
            ) : (
              <NativeNavMenu onNavigate={onClose} />
            )}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {!isSuperAdmin ? (
              <>
                <Pressable style={styles.link} onPress={() => go(PATHS.MY_PROFILE)}>
                  <Ionicons name="person-outline" size={20} color={colors.accent} />
                  <Text style={[styles.linkText, { color: colors.primaryText }]}>Mi perfil</Text>
                </Pressable>
                {(user?.role === "company" || user?.role === "admin") && (
                  <Pressable style={styles.link} onPress={() => go(PATHS.CONFIGURATION)}>
                    <Ionicons name="settings-outline" size={20} color={colors.accent} />
                    <Text style={[styles.linkText, { color: colors.primaryText }]}>Configuración</Text>
                  </Pressable>
                )}
              </>
            ) : null}

            <Pressable style={[styles.logoutBtn, { borderColor: "#ef4444" }]} onPress={() => void handleLogout()}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>
          </ScrollView>

          <View style={styles.brandFooter}>
            <ThemeBrandLogo style={styles.brand} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.45)" },
  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    paddingHorizontal: 14,
  },
  drawerAccent: { position: "absolute", top: 0, left: 0, right: 0 },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  userBlock: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  userText: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "700" },
  userRole: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  drawerHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 16, fontWeight: "600" },
  navScroll: { flex: 1 },
  nav: { paddingTop: 8, paddingBottom: 12 },
  menuBlock: { gap: 4 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.menuItem,
  },
  linkText: { fontSize: 15, fontWeight: "600" },
  divider: { height: 1, marginVertical: 16 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.menuItem,
    borderWidth: 1,
    marginTop: 4,
  },
  logoutText: { color: "#ef4444", fontSize: 15, fontWeight: "700" },
  brandFooter: { alignItems: "center", paddingTop: 8 },
  brand: { width: 120, height: 36, opacity: 0.85 },
});
