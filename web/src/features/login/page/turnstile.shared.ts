import { TURNSTILE_SITE_KEY } from "./turnstileSiteKey";

export { TURNSTILE_SITE_KEY };

export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";

export const TURNSTILE_WIDGET_HEIGHT = 140;

/**
 * HTML inline con el patrón oficial de Cloudflare: el script se carga con
 * `?onload=onloadTurnstileCallback`, y Cloudflare invoca esa función global solo
 * cuando la API completa (`turnstile.render`) ya está disponible. Esto evita el
 * error "render is not a function" que ocurre con `render=explicit`.
 */
export function buildTurnstileHtml(siteKey: string): string {
  const key = siteKey.replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #fff; overflow: hidden; }
    body { display: flex; align-items: center; justify-content: center; padding: 8px; }
    #cf-widget { min-height: 70px; min-width: 280px; display: flex; align-items: center; justify-content: center; }
    #status { font-size: 11px; color: #64748b; text-align: center; padding: 8px; }
  </style>
</head>
<body>
  <div id="status">Cargando captcha…</div>
  <div id="cf-widget"></div>
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

      // Cloudflare llama a esta función cuando la API está totalmente lista.
      window.onloadTurnstileCallback = function () {
        if (rendered || !window.turnstile) return;
        try {
          if (statusEl) statusEl.style.display = "none";
          window.turnstile.render("#cf-widget", {
            sitekey: "${key}",
            callback: function (token) { post("verify", token); },
            "expired-callback": function () { post("expire"); },
            "error-callback": function (code) {
              post("error", "", "error-callback Turnstile (" + (code || "?") + ") origen=" + location.origin);
            },
            theme: "light",
            size: "normal",
          });
          rendered = true;
          post("ready");
        } catch (e) {
          post("error", "", "render() lanzó: " + (e && e.message ? e.message : e));
        }
      };

      setStatus("inyectando script cloudflare");
      var s = document.createElement("script");
      s.src = "${TURNSTILE_SCRIPT_SRC}";
      s.async = true;
      s.defer = true;
      s.onerror = function () {
        post("error", "", "onerror al descargar api.js — sin acceso a challenges.cloudflare.com");
      };
      document.head.appendChild(s);

      setTimeout(function () {
        if (!rendered) {
          post("error", "", "Timeout 30s (turnstile=" + (!!window.turnstile) + ")");
        }
      }, 30000);
    })();
  </script>
</body>
</html>`;
}
