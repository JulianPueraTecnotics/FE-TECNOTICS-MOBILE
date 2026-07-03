import { API_ROUTES } from "../../utils/global";
import { downloadFromUrl } from "../../utils/downloadFromUrl.native";

export const openPurchasePdfNative = (purchaseId: string, label: string) =>
  downloadFromUrl(
    API_ROUTES.PURCHASE_PDF(purchaseId),
    `compra-${label.replace(/[^a-z0-9]+/gi, "_")}.pdf`,
    "application/pdf",
  );
