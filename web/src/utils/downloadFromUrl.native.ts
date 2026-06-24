import { saveAndShareBlob } from "./downloadFile.native";

/** Descarga un archivo autenticado (cookies) y abre el diálogo de compartir/guardar. */
export async function downloadFromUrl(
  url: string,
  fallbackName: string,
  mimeType?: string
): Promise<{ total?: number; succeeded?: number; failed?: number }> {
  const response = await fetch(url, { method: "GET", credentials: "include" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || "No se pudo descargar el archivo");
  }
  const meta = {
    total: Number(response.headers.get("X-PDFs-Total")) || undefined,
    succeeded: Number(response.headers.get("X-PDFs-Succeeded")) || undefined,
    failed: Number(response.headers.get("X-PDFs-Failed")) || undefined,
  };
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || fallbackName;
  const blob = await response.blob();
  await saveAndShareBlob(blob, filename, mimeType || blob.type || "application/octet-stream");
  return meta;
}
