import { Platform } from "react-native";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppRouter from "./router/index.route";
import { AuthProvider } from "./store/auth.provider";
import { AuthLoader } from "./store/AuthLoader";
import { ThemeProvider } from "./store/theme.context";
import { ensureStorageHydrated } from "./utils/storage";
import { NativeThemeRoot } from "./components/shared/NativeThemeRoot";
import ThemeAwareStatusBar from "./components/shared/ThemeAwareStatusBar";

if (Platform.OS === "web") {
  require("./index.css");
  require("./mobile-overrides.css");
}

/** Portal completo — montado por Expo Router/Metro, sin WebView. */
export default function PortalApp() {
  useEffect(() => {
    if (Platform.OS !== "web") {
      void ensureStorageHydrated();
    }
  }, []);

  const app = (
    <ThemeProvider>
      <NativeThemeRoot>
        <ThemeAwareStatusBar />
        <AuthProvider>
          <AuthLoader>
            <AppRouter />
          </AuthLoader>
        </AuthProvider>
      </NativeThemeRoot>
    </ThemeProvider>
  );

  if (Platform.OS === "web") {
    return app;
  }

  return <SafeAreaProvider>{app}</SafeAreaProvider>;
}
