/** Archivo seleccionado con expo-document-picker (React Native FormData). */
export type NativeUploadFile = { uri: string; name: string; type: string };

export function appendNativeFiles(formData: FormData, files: NativeUploadFile[], field = "files") {
  for (const f of files) {
    formData.append(field, { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
  }
}
