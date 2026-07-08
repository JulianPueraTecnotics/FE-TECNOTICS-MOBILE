import { Platform } from "react-native";
import { useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import "./shims/fixExpoStaticError";
import AppRouter from "./router/index.route";
import { AuthProvider } from "./store/auth.provider";
import { AuthLoader } from "./store/AuthLoader";
import { ThemeProvider } from "./store/theme.context";
import { ensureStorageHydrated } from "./utils/storage";
import { NativeThemeRoot } from "./components/shared/NativeThemeRoot";
import ThemeAwareStatusBar from "./components/shared/ThemeAwareStatusBar";
import { ConfirmProvider } from "./components/design-system";

if (Platform.OS === "web") {
  require("./index.css");
  require("./mobile-overrides.css");
  require("./components/design-system/styles/design-system.css");
  require("./components/shared/theme/ThemeToggle.css");
}

/** Portal completo — montado por Expo Router/Metro, sin WebView. */
export default function PortalApp() {
  useEffect(() => {
    void ensureStorageHydrated();
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const app = (
    <ThemeProvider>
      <NativeThemeRoot>
        <ThemeAwareStatusBar />
        <AuthProvider>
          <ConfirmProvider>
            <AuthLoader>
              <AppRouter />
            </AuthLoader>
          </ConfirmProvider>
        </AuthProvider>
      </NativeThemeRoot>
    </ThemeProvider>
  );

  return app;
}
