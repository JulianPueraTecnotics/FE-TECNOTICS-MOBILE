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
import { getDrawerShadow, SHELL_RADIUS } from "./shellStyles.native";
import ThemeBrandLogo from "../shared/ThemeBrandLogo.native";
import ThemeSwitch from "../shared/ThemeSwitch.native";
import { PATHS } from "../../router/paths.contants";
import { AuthContext } from "../../store/auth.context";
import { useThemeColors } from "../../theme/useThemeColors";

interface PublicMobileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const DRAWER_WIDTH = Math.min(Dimensions.get("window").width * 0.82, 320);

const PublicMobileDrawer: React.FC<PublicMobileDrawerProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const slideX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const drawerShadow = getDrawerShadow();

  useEffect(() => {
    if (!visible) return;
    slideX.setValue(DRAWER_WIDTH);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, slideX]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const isSuperAdmin = user?.role === "super_admin";
  const homePath = isSuperAdmin ? PATHS.ADMIN_HOME : PATHS.DASHBOARD;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 20,
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          <View style={styles.drawerAccent}>
            <AccentStrip height={2} opacity={0.75} />
          </View>

          <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
            <ThemeBrandLogo style={styles.brand} />
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
            <Pressable
              style={[styles.link, { backgroundColor: colors.bgSubtle }]}
              onPress={() => go(PATHS.HOME)}
            >
              <Text style={[styles.linkText, { color: colors.primaryText }]}>Inicio</Text>
            </Pressable>
            <Pressable style={styles.link} onPress={() => go(PATHS.HOME_HOW_IT_WORKS)}>
              <Text style={[styles.linkText, { color: colors.primaryText }]}>Cómo funciona</Text>
            </Pressable>
            <Pressable style={styles.link} onPress={() => go(PATHS.HOME_PLANS)}>
              <Text style={[styles.linkText, { color: colors.primaryText }]}>Planes</Text>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {!user ? (
              <>
                <Pressable
                  style={[styles.btnSecondary, { borderColor: colors.accent }]}
                  onPress={() => go(PATHS.LOGIN)}
                >
                  <Text style={[styles.btnSecondaryText, { color: colors.accent }]}>Iniciar sesión</Text>
                </Pressable>
                <Pressable
                  style={[styles.btnPrimary, { backgroundColor: colors.accent }]}
                  onPress={() => go(PATHS.REGISTER)}
                >
                  <Text style={styles.btnPrimaryText}>Registrarse</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.btnPrimary, { backgroundColor: colors.accent }]}
                onPress={() => go(homePath)}
              >
                <Text style={styles.btnPrimaryText}>
                  {isSuperAdmin ? "Volver al panel" : "Volver a facturación"}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.45)" },
  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    borderLeftWidth: 1,
    paddingHorizontal: 16,
  },
  drawerAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  brand: { width: 130, height: 40, flex: 1 },
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
  nav: { gap: 4, paddingTop: 8, paddingBottom: 24 },
  link: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: SHELL_RADIUS.menuItem,
    justifyContent: "center",
  },
  linkText: { fontSize: 15, fontWeight: "600" },
  divider: { height: 1, marginVertical: 20 },
  btnSecondary: {
    borderWidth: 2,
    borderRadius: SHELL_RADIUS.menuItem,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 10,
  },
  btnSecondaryText: { fontSize: 15, fontWeight: "700" },
  btnPrimary: {
    borderRadius: SHELL_RADIUS.menuItem,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default PublicMobileDrawer;
