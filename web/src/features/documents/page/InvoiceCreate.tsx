import { Navigate } from "react-router-dom";
import { PATHS } from "../../../router/paths.contants";

/** En web el editor completo está en Dashboard (fe-billing). */
export default function InvoiceCreate() {
  return <Navigate to={PATHS.DASHBOARD} replace />;
}
