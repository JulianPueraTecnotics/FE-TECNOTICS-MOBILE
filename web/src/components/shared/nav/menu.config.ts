import { PATHS } from "../../../router/paths.contants";
import type { AuthUserRole } from "../../../store/auth.context";

/**
 * Modelo de menú declarativo, ÚNICA fuente de verdad para la navegación de empresa.
 * Lo consumen tanto el Sidebar (móvil) como el Navbar (desktop), para no duplicar la
 * lista de enlaces en dos componentes (deuda histórica que esto elimina).
 *
 * - `path`     → enlace navegable directo.
 * - `children` → grupo expandible (acordeón). Un grupo NO navega; despliega sus hijos.
 * - `roles`    → si se define, el item solo se muestra a esos roles. Si se omite, visible a todos.
 * - `comingSoon` → módulo aún no construido; lleva a la página placeholder "Próximamente".
 *
 * Origen previsto de cada módulo nuevo (ver docs/PROYECCION-NAVEGACION-MODULOS.md):
 *   Ventas/Recaudos, Compras, Cajas y bancos, Contabilidad → repos Causación/Tesorería.
 *   Ventas/Cotizaciones → repos fichas_tecnicas.
 */

export interface MenuItem {
    /** Etiqueta visible */
    label: string;
    /** Clase de icono remixicon (ej. "ri-shopping-cart-2-line") */
    icon?: string;
    /** Ruta destino. Ausente en grupos (los grupos solo expanden hijos). */
    path?: string;
    /** Sub-items: convierte este item en grupo expandible (acordeón). */
    children?: MenuItem[];
    /** Roles que pueden ver el item. Si se omite, visible para cualquier sesión de empresa. */
    roles?: Exclude<AuthUserRole, null>[];
    /** Módulo en construcción → redirige a la página "Próximamente". */
    comingSoon?: boolean;
}

/** Menú de empresa/usuario (no superadmin), en el orden de negocio acordado. */
export const COMPANY_MENU: MenuItem[] = [
    {
        label: "Inicio",
        icon: "ri-home-5-line",
        path: PATHS.DASHBOARD,
    },
    {
        label: "Ventas",
        icon: "ri-shopping-cart-2-line",
        children: [
            { label: "Facturas", icon: "ri-file-list-3-line", path: PATHS.DOCUMENTS },
            { label: "Recaudos", icon: "ri-hand-coin-line", path: PATHS.SALES_RECAUDOS },
            { label: "Cotizaciones", icon: "ri-draft-line", path: PATHS.SALES_COTIZACIONES_NUEVA },
            { label: "Remisiones", icon: "ri-truck-line", path: PATHS.SALES_REMISIONES },
            { label: "Facturas de plantilla", icon: "ri-file-copy-2-line", path: PATHS.SALES_PLANTILLAS },
            { label: "Clientes", icon: "ri-group-line", path: PATHS.CLIENTS },
        ],
    },
    {
        label: "Compras y gastos",
        icon: "ri-shopping-bag-3-line",
        children: [
            { label: "Proveedores", icon: "ri-building-2-line", path: PATHS.PURCHASES_SUPPLIERS },
            { label: "Compras", icon: "ri-file-text-line", path: PATHS.PURCHASES_COMPRAS },
            { label: "Gastos", icon: "ri-wallet-line", path: PATHS.PURCHASES_GASTOS },
            { label: "Parametrización", icon: "ri-price-tag-3-line", path: PATHS.PURCHASES_PARAM },
        ],
    },
    {
        label: "Productos y servicios",
        icon: "ri-box-3-line",
        path: PATHS.PRODUCTS_SERVICES,
    },
    {
        label: "Terceros",
        icon: "ri-contacts-book-line",
        path: PATHS.TERCEROS,
    },
    {
        label: "Tesorería",
        icon: "ri-bank-line",
        children: [
            { label: "Pagos a proveedores", icon: "ri-secure-payment-line", path: PATHS.TREASURY_PAGOS },
            { label: "Lotes de pago", icon: "ri-stack-line", path: PATHS.TREASURY_LOTES },
            { label: "Conciliación bancaria", icon: "ri-scales-3-line", path: PATHS.TREASURY_CONCILIACION },
            { label: "Bancos", icon: "ri-bank-card-line", path: PATHS.TREASURY_BANCOS },
        ],
    },
    {
        label: "Nómina",
        icon: "ri-wallet-3-line",
        path: PATHS.NOMINA_EMPLEADOS,
    },
    {
        label: "Contabilidad",
        icon: "ri-book-2-line",
        children: [
            { label: "Comprobantes", icon: "ri-file-list-3-line", path: PATHS.ACCOUNTING + "?sec=comprobantes" },
            { label: "Libro diario", icon: "ri-book-open-line", path: PATHS.ACCOUNTING + "?sec=diario" },
            { label: "Mayor y balances", icon: "ri-archive-line", path: PATHS.ACCOUNTING + "?sec=mayor" },
            { label: "Balance de prueba", icon: "ri-scales-3-line", path: PATHS.ACCOUNTING + "?sec=balance" },
            { label: "Estados financieros", icon: "ri-line-chart-line", path: PATHS.ACCOUNTING + "?sec=estados" },
            { label: "Saldos iniciales", icon: "ri-flag-line", path: PATHS.ACCOUNTING + "?sec=saldos" },
            { label: "Cierre anual", icon: "ri-lock-2-line", path: PATHS.ACCOUNTING + "?sec=cierre" },
            { label: "Períodos", icon: "ri-calendar-close-line", path: PATHS.ACCOUNTING + "?sec=periodos" },
            { label: "Activos fijos", icon: "ri-computer-line", path: PATHS.FIXED_ASSETS },
            { label: "DIAN / Exógena", icon: "ri-government-line", path: PATHS.ACCOUNTING + "?sec=dian" },
        ],
    },
    {
        label: "Reportes",
        icon: "ri-bar-chart-box-line",
        children: [
            { label: "Estadísticas", icon: "ri-line-chart-line", path: PATHS.ANALYTICS },
            { label: "Sincronización DIAN", icon: "ri-government-line", path: PATHS.DIAN_SYNC },
        ],
    },
    // "Usuarios" se movió al menú de configuración de empresa (UserMenu, bajo
    // "Mi Perfil"). Sigue restringido a cuenta titular (no rol "user").
];

/** ¿El item (o alguno de sus hijos) es visible para el rol dado? */
export function isItemVisible(item: MenuItem, role: AuthUserRole): boolean {
    if (item.roles && (!role || !item.roles.includes(role))) return false;
    return true;
}

/** Filtra recursivamente el menú según el rol, descartando grupos que quedan vacíos. */
export function filterMenuByRole(menu: MenuItem[], role: AuthUserRole): MenuItem[] {
    return menu
        .filter((item) => isItemVisible(item, role))
        .map((item) =>
            item.children
                ? { ...item, children: item.children.filter((c) => isItemVisible(c, role)) }
                : item,
        )
        .filter((item) => !item.children || item.children.length > 0);
}

/** ¿La ruta activa cae dentro de este grupo? (para auto-expandir el acordeón correcto). */
export function isGroupActive(item: MenuItem, pathname: string): boolean {
    if (!item.children) return false;
    // Comparamos solo la parte de ruta (sin query string), por si el path lleva "?sec=...".
    return item.children.some((c) => {
        if (!c.path) return false;
        const base = c.path.split("?")[0];
        return pathname.startsWith(base);
    });
}
