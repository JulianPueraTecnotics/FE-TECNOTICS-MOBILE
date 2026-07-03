import { API_ROUTES } from "../utils/global";
import { getItemSync, removeItemSync, setItemSync } from "../utils/storage";

export const SESSION_HINT_KEY = "tecnotics_has_session";

export function markSessionHint(): void {
  setItemSync(SESSION_HINT_KEY, "1");
}

export function clearSessionHint(): void {
  removeItemSync(SESSION_HINT_KEY);
}

export function hasSessionHint(): boolean {
  return getItemSync(SESSION_HINT_KEY) === "1";
}

type SessionData = unknown | null;

let inflightWhoami: Promise<SessionData> | null = null;

async function fetchWhoami(): Promise<SessionData> {
  try {
    const response = await fetch(API_ROUTES.WHOAMI, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 404) {
      return fetchWhoamiLegacy();
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) clearSessionHint();
      return null;
    }

    const data = await response.json();
    const payload = data.data ?? null;
    if (payload) markSessionHint();
    else clearSessionHint();
    return payload;
  } catch {
    return fetchWhoamiLegacy();
  }
}

/** Fallback si el backend aún no expone /auth/whoami. */
async function fetchWhoamiLegacy(): Promise<SessionData> {
  const company = await fetchLegacy(API_ROUTES.VALIDATE_SESSION);
  if (company) {
    markSessionHint();
    return company;
  }
  const admin = await fetchLegacy(API_ROUTES.ADMIN_ME);
  if (admin) {
    markSessionHint();
    return admin;
  }
  clearSessionHint();
  return null;
}

async function fetchLegacy(url: string): Promise<SessionData> {
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (response.status === 401 || response.status === 403 || !response.ok) return null;
    const data = await response.json();
    return data.data ?? null;
  } catch {
    return null;
  }
}

export const validateSessionService = (): Promise<SessionData> => {
  if (inflightWhoami) return inflightWhoami;
  inflightWhoami = fetchWhoami().finally(() => {
    inflightWhoami = null;
  });
  return inflightWhoami;
};

/** @deprecated Usar validateSessionService (whoami unificado). */
export const validateAdminSessionService = validateSessionService;
