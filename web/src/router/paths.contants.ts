export const PATHS = {
    //#==== PUBLIC PATHS ====#//
    HOME: "/",
    LOGIN: "/login",
    REGISTER: "/register",
    FORGOT_PASSWORD: "/recuperar-contrasena",
    /** Enlace del correo: firma del contrato mandato y continuación al step 4 */
    CONTINUE_MANDATO: "/continue/mandato/:companyId",
    /** Vista pública de una cotización (link compartido al cliente, sin sesión) */
    QUOTE_PUBLIC: "/cot/public/:slug",
    /** Vista pública de remisión para firmar (link al cliente, sin sesión) */
    REMISION_PUBLIC: "/remision/firmar/:slug",
    HOME_HOW_IT_WORKS: "/#como-funciona",
    HOME_PLANS: "/#planes",

    //#==== PRIVATE PATHS ====#//
    /** Inicio: dashboard del dueño (KPIs + calendario tributario DIAN). */
    DASHBOARD: "/dashboard",
    /** Login del contador (multi-empresa): credenciales → selector de empresa */
    CONTADOR_LOGIN: "/contador",
    /** Facturar: el widget de facturación del SDK fe-billing (antes era el inicio). */
    DASHBOARD_BILLING: "/facturar",
    /** POS: misma pantalla de facturación que Facturar (ruta separada para el menú). */
    POS: "/facturar/pos",
    DOCUMENTS: "/documentos",
    /** Crear factura (nativo: SDK billing; web: redirige a /facturar). */
    DOCUMENT_CREATE: "/documentos/nueva",
    DOCUMENT_DETAIL: "/documentos/:id",
    CLIENTS: "/clientes",
    /** Gestión de subusuarios (solo cuenta empresa) */
    SUB_USERS: "/sub-usuarios",
    PRODUCTS_SERVICES: "/productos-servicios",
    /** Maestro de terceros unificado (clientes, proveedores, empleados) */
    TERCEROS: "/terceros",
    BILLING_HISTORY: "/historico-facturacion",
    /** Módulo de analítica/estadísticas financieras (libro mayor) */
    ANALYTICS: "/estadisticas",
    DIAN_SYNC: "/sincronizacion-dian",
    DIAN_RECONCILE: "/conciliacion-dian",
    DIAN_RECONCILE_SALES: "/conciliacion-dian-emitidas",
    NOMINA_EMPLEADOS: "/nomina-empleados",
    MY_PROFILE: "/mi-perfil",
    /** Configuración de empresa (facturación, documentos, eventos, usuarios, contable) */
    CONFIGURATION: "/configuracion",

    //#==== MÓDULOS NUEVOS (placeholder "Próximamente") ====#//
    // Ventas
    /** Recaudos / cartera de clientes (cuentas por cobrar). Origen: Causación/Tesorería (reorientar a ventas) */
    SALES_RECAUDOS: "/ventas/recaudos",
    /** Cotizaciones. Origen: fichas_tecnicas (módulo cotizaciones) */
    SALES_COTIZACIONES: "/ventas/cotizaciones",
    /** Editor de cotización (pantalla completa): nueva */
    SALES_COTIZACIONES_NUEVA: "/ventas/cotizaciones/nueva",
    /** Editor de cotización (pantalla completa): editar por id */
    SALES_COTIZACIONES_EDITAR: (id: string) => `/ventas/cotizaciones/${id}/editar`,
    /** Remisiones (entrega sin facturar) */
    SALES_REMISIONES: "/ventas/remisiones",
    /** Facturas de plantilla (recurrentes) */
    SALES_PLANTILLAS: "/ventas/facturas-plantilla",
    // Compras y gastos. Origen: Causación/Tesorería (compras/causación)
    PURCHASES: "/compras-gastos",
    /** Proveedores (agenda de proveedores) */
    PURCHASES_SUPPLIERS: "/compras-gastos/proveedores",
    /** Compras (facturas de compra importadas desde XML/ZIP DIAN) */
    PURCHASES_COMPRAS: "/compras-gastos/compras",
    /** Gastos (facturas/comprobantes de gasto importados) */
    PURCHASES_GASTOS: "/compras-gastos/gastos",
    /** Parametrización contable de productos por proveedor (cuentas + retención + IA) */
    PURCHASES_PARAM: "/compras-gastos/parametrizacion",
    // Tesorería. Origen: Causación/Tesorería (pagos a proveedores, lotes, bancos, conciliación)
    TREASURY: "/tesoreria",
    /** Pagos a proveedores: facturas pendientes → generar lote de pago */
    TREASURY_PAGOS: "/tesoreria/pagos",
    /** Historial de lotes de pago (generar, firmar, conciliar) */
    TREASURY_LOTES: "/tesoreria/lotes",
    /** Configuración de bancos de la empresa (cuentas origen) */
    TREASURY_BANCOS: "/tesoreria/bancos",
    /** Conciliación bancaria — módulo nuevo (matching automático ingresos/egresos) */
    TREASURY_CONCILIACION: "/tesoreria/conciliacion",
    /** Importar extracto (CSV/XLSX con mapeo de columnas, cualquier banco) */
    TREASURY_IMPORT_EXTRACTO: "/tesoreria/importar-extracto",
    /** Cartera por cliente (saldos y pagos aplicados) */
    TREASURY_CARTERA: "/tesoreria/cartera",
    /** Saldos por proveedor (cuentas por pagar) */
    TREASURY_CXP: "/tesoreria/saldos-proveedor",
    /** Bolsa de pagos sin asignar (reclasificar 22050501) */
    TREASURY_BOLSA: "/tesoreria/bolsa-pagos",
    /** Conciliación asistida anterior (fuera del menú, accesible por URL) */
    TREASURY_CONCILIAR_BANCO: "/tesoreria/conciliar-banco",
    /** Pantalla vieja extracto-vs-libros (fuera del menú, accesible por URL) */
    TREASURY_RECON_LEGACY: "/tesoreria/conciliacion-extracto",
    // Contabilidad. Origen: Causación/Tesorería (PUC, cierres, comprobantes)
    ACCOUNTING: "/contabilidad",
    /** Activos fijos (ficha, depreciación línea recta, baja/venta) */
    FIXED_ASSETS: "/contabilidad/activos-fijos",

    /** Inventario (kardex, existencias, bodegas, costeo promedio). Secciones por ?sec= */
    INVENTORY: "/inventario",

    //#==== SUPERADMIN PANEL (mismo login/navbar, links adaptados) ====#//
    /** Home del panel = listado de empresas */
    ADMIN_HOME: "/admin",
    ADMIN_ADMINS: "/admin/administradores",
    ADMIN_CONTADORES: "/admin/contadores",
    ADMIN_PLANS: "/admin/planes",
    ADMIN_COMPANY_DETAIL: (companyId: string) => `/admin/empresas/${companyId}`,
};
