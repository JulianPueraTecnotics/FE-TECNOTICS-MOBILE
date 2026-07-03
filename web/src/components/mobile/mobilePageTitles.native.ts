import { PATHS } from "../../router/paths.contants";
import { APP_BRAND_NAME } from "../../utils/global";

const PAGE_TITLES: Record<string, string> = {
  [PATHS.DASHBOARD]: "Inicio",
  [PATHS.DASHBOARD_BILLING]: "Facturar",
  [PATHS.POS]: "POS",
  [PATHS.DOCUMENTS]: "Facturas",
  [PATHS.CLIENTS]: "Clientes",
  [PATHS.PRODUCTS_SERVICES]: "Productos",
  [PATHS.TERCEROS]: "Terceros",
  [PATHS.NOMINA_EMPLEADOS]: "Nómina",
  [PATHS.ANALYTICS]: "Estadísticas",
  [PATHS.DIAN_SYNC]: "Sincronización DIAN",
  [PATHS.DIAN_RECONCILE]: "Conciliación DIAN",
  [PATHS.DIAN_RECONCILE_SALES]: "Conciliación emitidas",
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
  [PATHS.TREASURY_IMPORT_EXTRACTO]: "Importar extracto",
  [PATHS.TREASURY_CARTERA]: "Cartera por cliente",
  [PATHS.TREASURY_CXP]: "Saldos por proveedor",
  [PATHS.TREASURY_BOLSA]: "Bolsa de pagos",
  [PATHS.ACCOUNTING]: "Contabilidad",
  [PATHS.FIXED_ASSETS]: "Activos fijos",
  [PATHS.BILLING_HISTORY]: "Histórico",
  [PATHS.INVENTORY]: "Inventario",
  [PATHS.ADMIN_HOME]: "Empresas",
  [PATHS.ADMIN_PLANS]: "Planes",
  [PATHS.ADMIN_ADMINS]: "Administradores",
  [PATHS.ADMIN_CONTADORES]: "Contadores",
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
  terceros: "Auxiliar por tercero",
  notas: "Notas EEFF",
  presupuesto: "Presupuesto",
  fiscal: "Conciliación fiscal",
  ajustes: "Ajustes contables",
  salud: "Salud contable",
  ica: "ReteICA por municipio",
};

const INVENTORY_SEC_TITLES: Record<string, string> = {
  existencias: "Existencias",
  kardex: "Kardex",
  valorizado: "Valorizado",
  bodegas: "Bodegas",
  ajustes: "Ajustes",
  traslados: "Traslados",
  saldos: "Saldos iniciales",
};

export function resolveMobilePageTitle(pathname: string, search = ""): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];

  if (pathname === PATHS.NOMINA_EMPLEADOS) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const sec = params.get("sec");
    if (sec === "nomina") return "Nómina";
    if (sec === "pila") return "PILA";
    if (sec === "certificados") return "Certificados";
    return "Empleados";
  }

  if (pathname === PATHS.ACCOUNTING) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const sec = params.get("sec");
    if (sec && ACCOUNTING_SEC_TITLES[sec]) return ACCOUNTING_SEC_TITLES[sec];
    return "Contabilidad";
  }

  if (pathname === PATHS.INVENTORY) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const sec = params.get("sec");
    if (sec && INVENTORY_SEC_TITLES[sec]) return INVENTORY_SEC_TITLES[sec];
    return "Inventario";
  }

  if (pathname.startsWith("/ventas/cotizaciones/") && pathname.endsWith("/editar")) {
    return "Editar cotización";
  }
  if (pathname.startsWith("/documentos/")) return "Detalle factura";
  if (pathname.startsWith("/admin/empresas/")) return "Empresa";
  if (pathname.startsWith("/tesoreria")) return "Tesorería";
  if (pathname.startsWith("/compras-gastos")) return "Compras y gastos";
  if (pathname.startsWith("/ventas/")) return "Ventas";
  return APP_BRAND_NAME;
}
