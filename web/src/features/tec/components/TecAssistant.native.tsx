import { useContext, useEffect } from "react";
import { Modal } from "react-native";
import { useLocation } from "react-router-dom";
import { PATHS } from "../../../router/paths.contants";
import { AuthContext } from "../../../store/auth.context";
import { getTecContext, setTecContext } from "../tec-context";
import { closeTec, useTecOpen } from "../tec-open-store";
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
  const location = useLocation();
  const { user, isLoading } = useContext(AuthContext);
  const open = useTecOpen();

  useEffect(() => {
    const r = RUTA_PANTALLA.find((x) => x.match(location.pathname));
    const actual = getTecContext();
    if (r && (!actual || actual.pantalla !== r.pantalla)) {
      setTecContext({ pantalla: r.pantalla, titulo: r.titulo });
    }
  }, [location.pathname]);

  useEffect(() => {
    closeTec();
  }, [location.pathname]);

  if (isLoading || !user?.id || user.role === "super_admin") return null;
  if (HIDE_PATHS.some((p) => location.pathname === p || location.pathname.startsWith("/cot/public"))) return null;

  return (
    <Modal visible={open} animationType="slide" onRequestClose={closeTec}>
      <TecChatNative onClose={closeTec} />
    </Modal>
  );
}
