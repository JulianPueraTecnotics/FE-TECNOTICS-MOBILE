type TurnstileCallbackHandler = (token: string) => void;

let pendingHandler: TurnstileCallbackHandler | null = null;
let pendingToken: string | null = null;

export function registerTurnstileCallbackHandler(handler: TurnstileCallbackHandler): () => void {
  pendingHandler = handler;
  if (pendingToken) {
    handler(pendingToken);
    pendingToken = null;
  }
  return () => {
    if (pendingHandler === handler) pendingHandler = null;
  };
}

/** Guarda el token aunque el login aún no haya montado el handler (deep link). */
export function completeTurnstileCallback(token: string): void {
  const trimmed = token.trim();
  if (!trimmed) return;
  if (pendingHandler) {
    pendingHandler(trimmed);
    pendingToken = null;
    return;
  }
  pendingToken = trimmed;
}

export function consumePendingTurnstileToken(): string | null {
  const token = pendingToken;
  pendingToken = null;
  return token;
}
