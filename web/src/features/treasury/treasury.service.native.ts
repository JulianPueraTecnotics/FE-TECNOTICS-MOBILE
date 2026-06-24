import { API_ROUTES } from "../../utils/global";
import { downloadFromUrl } from "../../utils/downloadFromUrl.native";

export const downloadBatchFileNative = (id: string, fileName: string) =>
  downloadFromUrl(API_ROUTES.TREASURY_BATCH_DOWNLOAD(id), fileName || "lote.txt", "text/plain");
