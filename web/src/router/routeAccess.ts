import type { AuthUserRole } from "../store/auth.context";
import { PATHS } from "./paths.contants";

/** Rutas solo para cuenta titular (`company` / `admin`), igual que `companyOnly` en el portal. */
export const COMPANY_ONLY_PATHS: readonly string[] = [
  PATHS.SUB_USERS,
  PATHS.CONFIGURATION,
];

/** Prefijos reservados al panel superadmin. */
export const ADMIN_PATH_PREFIX = "/admin";

export function isCompanyOnlyPath(pathname: string): boolean {
  return COMPANY_ONLY_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`);
}

/**
 * Misma lógica de acceso que `PrivateMiddlewareRoute` + menú del portal.
 * - Sin sesión → ninguna ruta privada.
 * - `super_admin` → solo rutas `/admin/*`.
 * - Sesión empresa → no entra a `/admin/*`.
 * - Subusuario (`user`) → no entra a configuración ni sub-usuarios.
 */
export function canAccessPath(role: AuthUserRole, pathname: string): boolean {
  if (!role) return false;

  if (isAdminPath(pathname)) {
    return role === "super_admin";
  }

  if (role === "super_admin") {
    return false;
  }

  if (isCompanyOnlyPath(pathname) && role === "user") {
    return false;
  }

  return true;
}

/** Ruta de inicio según rol (post-login / redirect). */
export function getHomePathForRole(role: AuthUserRole): string {
  if (role === "super_admin") return PATHS.ADMIN_HOME;
  return PATHS.DASHBOARD;
}

/** Normaliza path+search para comparar acceso (solo pathname importa para permisos). */
export function getPathnameFromRoute(path: string): string {
  return path.split("?")[0] || PATHS.DASHBOARD;
}
