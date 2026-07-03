import { useEffect, useRef } from "react";
import { readEnv } from "../../../utils/readEnv";

/**
 * Widget de Cloudflare Turnstile (CAPTCHA anti-bot para el login).
 * Carga el script de Cloudflare una sola vez y renderiza el challenge; cuando el usuario
 * lo resuelve, llama onVerify(token). El token se envía al backend con las credenciales.
 *
 * La Site Key (pública) sale de VITE_TURNSTILE_SITE_KEY; si no está, usa la llave de
 * PRUEBA de Cloudflare (siempre pasa) para no bloquear el desarrollo.
 * (Misma lógica que FE_TECNOTICS_PORTAL/src/features/login/page/Turnstile.tsx)
 */

const SITE_KEY = readEnv("VITE_TURNSTILE_SITE_KEY") || "1x00000000000000000000AA";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
    render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    reset: (id?: string) => void;
    remove: (id?: string) => void;
}
declare global {
    interface Window {
        turnstile?: TurnstileApi;
        __turnstileLoading?: Promise<void>;
    }
}

function loadTurnstileScript(): Promise<void> {
    if (window.turnstile) return Promise.resolve();
    if (window.__turnstileLoading) return window.__turnstileLoading;
    window.__turnstileLoading = new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = SCRIPT_SRC;
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("No se pudo cargar Turnstile"));
        document.head.appendChild(s);
    });
    return window.__turnstileLoading;
}

interface TurnstileProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
}

const Turnstile: React.FC<TurnstileProps> = ({ onVerify, onExpire }) => {
    const ref = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadTurnstileScript()
            .then(() => {
                if (cancelled || !ref.current || !window.turnstile) return;
                widgetIdRef.current = window.turnstile.render(ref.current, {
                    sitekey: SITE_KEY,
                    callback: (token: string) => onVerify(token),
                    "expired-callback": () => onExpire?.(),
                    "error-callback": () => onExpire?.(),
                    theme: "auto",
                });
            })
            .catch(() => onExpire?.());

        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) {
                try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={ref} className="login__turnstile" />;
};

export default Turnstile;
