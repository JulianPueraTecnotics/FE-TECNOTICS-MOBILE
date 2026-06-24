import { lazy, type ComponentType } from "react";
import { Platform } from "react-native";

type PageModule = { default: ComponentType<unknown> };

const nativeModuleFallback = (): Promise<PageModule> =>
  import("../components/native/NativeModuleScreen.native");

/**
 * Carga lazy la página web del portal en web, o su versión nativa en iOS/Android.
 * Si no hay `.native.tsx`, usa `NativeModuleScreen` (sin redirigir al portal web).
 */
export function lazyPlatformPage(
  webImport: () => Promise<PageModule>,
  nativeImport?: () => Promise<PageModule>
) {
  return lazy(async () => {
    const mod =
      Platform.OS === "web"
        ? await webImport()
        : await (nativeImport ?? nativeModuleFallback)();
    if (!mod?.default) {
      throw new Error("La pantalla lazy no tiene export default");
    }
    return mod;
  });
}
