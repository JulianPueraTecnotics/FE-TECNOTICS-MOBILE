import { API_ROUTES } from "../../utils/global";
import { downloadFromUrl } from "../../utils/downloadFromUrl.native";

export const downloadExogenaXmlNative = (anio: number, formato: string) =>
  downloadFromUrl(
    `${API_ROUTES.LEDGER_DIAN_EXOGENA_XML}?anio=${anio}&formato=${formato}`,
    `exogena-${formato}-${anio}.xml`,
    "application/xml"
  );

export const downloadRetentionCertificateNative = (anio: number, tercero: string) =>
  downloadFromUrl(
    `${API_ROUTES.LEDGER_DIAN_RET_CERT}?anio=${anio}&tercero=${encodeURIComponent(tercero)}`,
    `certificado-retencion-${anio}.pdf`,
    "application/pdf"
  );
