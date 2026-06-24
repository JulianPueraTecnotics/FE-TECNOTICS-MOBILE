import { saveAndShareBase64 } from "./downloadFile.native";

type PdfPayload = {
  base64_quote?: string;
  base64_remision?: string;
  data_uri?: string;
  file_name?: string;
  mime_type?: string;
};

export async function sharePdfFromResponse(res: PdfPayload, fallbackName: string): Promise<void> {
  let base64 = res.base64_quote || res.base64_remision;
  if (!base64 && res.data_uri) {
    base64 = res.data_uri.includes(",") ? res.data_uri.split(",")[1]! : res.data_uri;
  }
  if (!base64) throw new Error("La respuesta no contiene el PDF");
  await saveAndShareBase64(base64, res.file_name || fallbackName, res.mime_type || "application/pdf");
}
