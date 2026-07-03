import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_") || "document.pdf";
}

async function writeBase64Pdf(base64: string, fileName: string): Promise<string> {
  const clean = base64.includes(",") ? base64.split(",")[1]! : base64;
  const uri = `${FileSystem.cacheDirectory}${sanitizeFileName(fileName)}`;
  await FileSystem.writeAsStringAsync(uri, clean, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

/** Imprime un PDF desde base64 usando el diálogo nativo del sistema (AirPrint / impresoras). */
export async function printPdfFromBase64(base64: string, fileName = "document.pdf"): Promise<void> {
  const uri = await writeBase64Pdf(base64, fileName);
  await Print.printAsync({ uri });
}

type PdfPayload = {
  base64_quote?: string;
  base64_remision?: string;
  base64_factura?: string;
  data_uri?: string;
  file_name?: string;
};

/** Imprime un PDF devuelto por el API (misma forma que sharePdfFromResponse). */
export async function printPdfFromResponse(res: PdfPayload, fallbackName: string): Promise<void> {
  let base64 = res.base64_quote || res.base64_remision || res.base64_factura;
  if (!base64 && res.data_uri) {
    base64 = res.data_uri.includes(",") ? res.data_uri.split(",")[1]! : res.data_uri;
  }
  if (!base64) throw new Error("La respuesta no contiene el PDF");
  await printPdfFromBase64(base64, res.file_name || fallbackName);
}
