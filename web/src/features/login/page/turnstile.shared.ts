import { TURNSTILE_SITE_KEY } from "./turnstileSiteKey";

export { TURNSTILE_SITE_KEY };

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TURNSTILE_WIDGET_HEIGHT = 140;

/** HTML inline — script estático en head (más fiable en WebView Android). */
export function buildTurnstileHtml(siteKey: string): string {
  const key = siteKey.replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;" />
  <script src="${TURNSTILE_SCRIPT_SRC}" async defer crossorigin="anonymous"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #fff; overflow: hidden; }
    body { display: flex; align-items: center; justify-content: center; padding: 8px; }
    #turnstile { min-height: 70px; min-width: 280px; display: flex; align-items: center; justify-content: center; }
    #status { font-size: 11px; color: #64748b; text-align: center; padding: 8px; }
  </style>
</head>
<body>
  <div id="status">Cargando captcha…</div>
  <div id="turnstile"></div>
  <script>
    (function () {
      var statusEl = document.getElementById("status");
      var rendered = false;

      function post(type, token, detail) {
        if (!window.ReactNativeWebView) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: type,
          token: token || "",
          detail: detail || ""
        }));
      }

      function setStatus(msg) {
        if (statusEl) statusEl.textContent = msg;
        post("status", "", msg);
      }

      function startRender(tries) {
        if (!window.turnstile) {
          if (tries > 120) {
            setStatus("Turnstile no respondió");
            post("error", "", "No se pudo cargar el script de Cloudflare. Revisa internet.");
            return;
          }
          setTimeout(function () { startRender(tries + 1); }, 100);
          return;
        }
        window.turnstile.ready(function () {
          if (rendered) return;
          try {
            if (statusEl) statusEl.style.display = "none";
            window.turnstile.render("#turnstile", {
              sitekey: "${key}",
              callback: function (token) { post("verify", token); },
              "expired-callback": function () { post("expire"); },
              "error-callback": function () {
                post("error", "", "Turnstile rechazó este origen (" + location.origin + ").");
              },
              theme: "light",
              size: "normal",
            });
            rendered = true;
            post("ready");
          } catch (e) {
            post("error", "", "No se pudo iniciar el widget.");
          }
        });
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { startRender(0); });
      } else {
        startRender(0);
      }

      setTimeout(function () {
        if (!rendered) {
          post("error", "", "Tiempo de espera agotado. Prueba: npm run adb-reverse");
        }
      }, 35000);
    })();
  </script>
</body>
</html>`;
}
