import { Platform } from "react-native";

export async function downloadBlobFile(
  blob: Blob,
  fileName: string,
  mimeType?: string
): Promise<void> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return;
  }

  const { saveAndShareBlob } = await import("./downloadFile.native");
  await saveAndShareBlob(blob, fileName, mimeType);
}
