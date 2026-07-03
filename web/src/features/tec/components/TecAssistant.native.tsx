import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet } from "react-native";
import { useLocation } from "react-router-dom";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { PATHS } from "../../../router/paths.contants";
import { AuthContext } from "../../../store/auth.context";
import { useThemeColors } from "../../../theme/useThemeColors";
import TecAvatar from "../../../assets/Tec_asistente.png";
import { getTecContext, setTecContext } from "../tec-context";
import TecChatNative from "./TecChat.native";

const RUTA_PANTALLA: { match: (p: string) => boolean; pantalla: string; titulo: string }[] = [
  { match: (p) => p.startsWith("/facturar"), pantalla: "facturas", titulo: "Facturar (nueva factura de venta)" },
  { match: (p) => p.startsWith("/documentos"), pantalla: "facturas", titulo: "Histórico de facturas de venta" },
  { match: (p) => p.startsWith("/compras"), pantalla: "compras", titulo: "Compras" },
  { match: (p) => p.startsWith("/gastos"), pantalla: "gastos", titulo: "Gastos" },
  {
    match: (p) => p.startsWith("/contabilidad") || p.startsWith("/comprobantes") || p.startsWith("/libros"),
    pantalla: "contabilidad",
    titulo: "Contabilidad",
  },
  { match: (p) => p.startsWith("/tesoreria"), pantalla: "tesoreria", titulo: "Tesorería" },
  {
    match: (p) => p.startsWith("/conciliacion") || p.startsWith("/dian/conciliacion"),
    pantalla: "conciliacion",
    titulo: "Consola de conciliación bancaria",
  },
  { match: (p) => p.startsWith("/recaudos"), pantalla: "recaudos", titulo: "Recaudos" },
  { match: (p) => p.startsWith("/dashboard"), pantalla: "inicio", titulo: "Panel de inicio (dashboard)" },
];

const HIDE_PATHS = [PATHS.LOGIN, PATHS.REGISTER, PATHS.FORGOT_PASSWORD, PATHS.HOME];

export default function TecAssistantNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const location = useLocation();
  const { user, isLoading } = useContext(AuthContext);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const r = RUTA_PANTALLA.find((x) => x.match(location.pathname));
    const actual = getTecContext();
    if (r && (!actual || actual.pantalla !== r.pantalla)) {
      setTecContext({ pantalla: r.pantalla, titulo: r.titulo });
    }
  }, [location.pathname]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (isLoading || !user?.id || user.role === "super_admin") return null;
  if (HIDE_PATHS.some((p) => location.pathname === p || location.pathname.startsWith("/cot/public"))) return null;

  return (
    <>
      {!open ? (
        <Pressable
          onPress={() => setOpen(true)}
          style={[
            styles.fab,
            getSoftCardShadow(colors),
            {
              bottom: insets.bottomNavTotalHeight + 12,
              backgroundColor: colors.headerAccent,
            },
          ]}
          accessibilityLabel="Abrir asistente TEC"
        >
          <Image source={TecAvatar} style={styles.fabAvatar} />
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" style={styles.fabBadge} />
        </Pressable>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <TecChatNative onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    zIndex: 1000,
  },
  fabAvatar: { width: 44, height: 44, borderRadius: 22 },
  fabBadge: { position: "absolute", bottom: 2, right: 2 },
});
