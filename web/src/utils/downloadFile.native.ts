import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer el archivo"));
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsDataURL(blob);
  });
}

/** Guarda un blob (Excel, PDF, etc.) y abre el diálogo de compartir/guardar del sistema. */
export async function saveAndShareBlob(
  blob: Blob,
  fileName: string,
  mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
): Promise<void> {
  const safeName = fileName.replace(/[^\w.\-() ]+/g, "_") || "export.xlsx";
  const base64 = await blobToBase64(blob);
  const uri = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: safeName, UTI: "com.microsoft.excel.xlsx" });
    return;
  }

  throw new Error("Compartir archivos no está disponible en este dispositivo");
}

/** Guarda base64 (PDF, etc.) y abre el diálogo de compartir del sistema. */
export async function saveAndShareBase64(
  base64: string,
  fileName: string,
  mimeType = "application/pdf"
): Promise<void> {
  const safeName = fileName.replace(/[^\w.\-() ]+/g, "_") || "document.pdf";
  const clean = base64.includes(",") ? base64.split(",")[1]! : base64;
  const uri = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(uri, clean, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: safeName });
    return;
  }

  throw new Error("Compartir archivos no está disponible en este dispositivo");
}
