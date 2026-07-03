/**
 * Cloudflare Turnstile requiere DOM; en nativo no hay WebView.
 * El captcha solo aplica en web (Turnstile.tsx). Este stub no renderiza nada.
 */
interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

export default function TurnstileNative(_props: TurnstileProps) {
  return null;
}
