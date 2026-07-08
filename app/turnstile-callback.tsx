import { useEffect } from "react";
import { useGlobalSearchParams, useLocalSearchParams, router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { completeTurnstileCallback } from "../web/src/features/login/page/turnstileCallbackBridge";
import { parseTurnstileCallbackToken } from "../web/src/features/login/page/turnstileSiteKey";

function readToken(raw: string | string[] | undefined): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value || null;
}

/** Recibe el token Turnstile vía deep link y cierra el navegador del sistema. */
export default function TurnstileCallbackScreen() {
  const local = useLocalSearchParams<{ token?: string | string[] }>();
  const global = useGlobalSearchParams<{ token?: string | string[] }>();

  useEffect(() => {
    const finish = (token: string | null) => {
      if (token) completeTurnstileCallback(token);
      void WebBrowser.dismissBrowser();
      router.replace("/");
    };

    const fromParams = readToken(local.token) ?? readToken(global.token);
    if (fromParams) {
      finish(fromParams);
      return;
    }

    void Linking.getInitialURL().then((url) => {
      if (!url) {
        finish(null);
        return;
      }
      finish(parseTurnstileCallbackToken(url));
    });
  }, [local.token, global.token]);

  return null;
}
