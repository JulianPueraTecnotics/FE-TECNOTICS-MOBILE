import { API_ROUTES } from "../utils/global";
import { downloadFromUrl } from "../utils/downloadFromUrl.native";

export const downloadForm220Native = (anio: number, empleadoId: string, nombre: string) =>
  downloadFromUrl(
    `${API_ROUTES.NOMINA_CERT_FORM220}?anio=${anio}&empleadoId=${empleadoId}`,
    `form220-${nombre.replace(/[^a-z0-9]+/gi, "_")}-${anio}.pdf`,
    "application/pdf"
  );
