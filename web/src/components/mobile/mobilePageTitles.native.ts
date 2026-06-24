import { PATHS } from "../../router/paths.contants";

const PAGE_TITLES: Record<string, string> = {
  [PATHS.DASHBOARD]: "Facturar",
  [PATHS.DOCUMENTS]: "Facturas",
  [PATHS.CLIENTS]: "Clientes",
  [PATHS.PRODUCTS_SERVICES]: "Productos",
  [PATHS.TERCEROS]: "Terceros",
  [PATHS.NOMINA_EMPLEADOS]: "Nómina",
  [PATHS.ANALYTICS]: "Estadísticas",
  [PATHS.DIAN_SYNC]: "Sincronización DIAN",
  [PATHS.MY_PROFILE]: "Mi perfil",
  [PATHS.CONFIGURATION]: "Configuración",
  [PATHS.SUB_USERS]: "Sub-usuarios",
  [PATHS.SALES_RECAUDOS]: "Recaudos",
  [PATHS.SALES_COTIZACIONES]: "Cotizaciones",
  [PATHS.SALES_COTIZACIONES_NUEVA]: "Nueva cotización",
  [PATHS.SALES_REMISIONES]: "Remisiones",
  [PATHS.SALES_PLANTILLAS]: "Facturas de plantilla",
  [PATHS.PURCHASES_SUPPLIERS]: "Proveedores",
  [PATHS.PURCHASES_COMPRAS]: "Compras",
  [PATHS.PURCHASES_GASTOS]: "Gastos",
  [PATHS.PURCHASES_PARAM]: "Parametrización",
  [PATHS.TREASURY_PAGOS]: "Pagos a proveedores",
  [PATHS.TREASURY_LOTES]: "Lotes de pago",
  [PATHS.TREASURY_BANCOS]: "Bancos",
  [PATHS.TREASURY_CONCILIACION]: "Conciliación bancaria",
  [PATHS.ACCOUNTING]: "Contabilidad",
  [PATHS.FIXED_ASSETS]: "Activos fijos",
  [PATHS.BILLING_HISTORY]: "Histórico",
  [PATHS.ADMIN_HOME]: "Empresas",
  [PATHS.ADMIN_PLANS]: "Planes",
  [PATHS.ADMIN_ADMINS]: "Administradores",
};

const ACCOUNTING_SEC_TITLES: Record<string, string> = {
  comprobantes: "Comprobantes",
  diario: "Libro diario",
  mayor: "Mayor y balances",
  balance: "Balance de prueba",
  estados: "Estados financieros",
  saldos: "Saldos iniciales",
  cierre: "Cierre anual",
  periodos: "Períodos",
  dian: "DIAN / Exógena",
};

export function resolveMobilePageTitle(pathname: string, search = ""): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];

  if (pathname === PATHS.ACCOUNTING) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const sec = params.get("sec");
    if (sec && ACCOUNTING_SEC_TITLES[sec]) return ACCOUNTING_SEC_TITLES[sec];
    return "Contabilidad";
  }

  if (pathname.startsWith("/ventas/cotizaciones/") && pathname.endsWith("/editar")) {
    return "Editar cotización";
  }
  if (pathname.startsWith("/documentos/")) return "Detalle factura";
  if (pathname.startsWith("/admin/empresas/")) return "Empresa";
  if (pathname.startsWith("/tesoreria")) return "Tesorería";
  if (pathname.startsWith("/compras-gastos")) return "Compras y gastos";
  if (pathname.startsWith("/ventas/")) return "Ventas";
  return "Tecnotics";
}
