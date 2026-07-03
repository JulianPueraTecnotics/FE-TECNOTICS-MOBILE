import Constants from "expo-constants";

export const APP_BRAND_NAME = "Tecnotics Contable";

interface ExpoExtra {
  apiBaseUrl?: string;
  feUrl?: string;
  epaycoPublicKey?: string;
  epaycoCustomerId?: string;
}

function readExtra(): ExpoExtra {
  return (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
}

function stripUrl(value: string | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\/$/, "") : "";
}

/**
 * Metro solo embebe EXPO_PUBLIC_* con acceso estático (process.env.EXPO_PUBLIC_X).
 * No usar process.env[variable]: en web queda undefined y cae al fallback de producción.
 */
function resolveApiUrl(): string {
  const fromEnv = stripUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (fromEnv) return fromEnv;
  const fromExtra = stripUrl(readExtra().apiBaseUrl);
  if (fromExtra) return fromExtra;
  const fromVite = stripUrl(process.env.VITE_APP_BACK_URL);
  if (fromVite) return fromVite;
  return __DEV__ ? "http://localhost:3001" : "https://facturacionelectronicatt.tecnotics.co";
}

function resolveFeUrl(): string {
  const fromEnv = stripUrl(process.env.EXPO_PUBLIC_FE_URL);
  if (fromEnv) return fromEnv;
  const fromExtra = stripUrl(readExtra().feUrl);
  if (fromExtra) return fromExtra;
  const fromVite = stripUrl(process.env.VITE_APP_FE_URL);
  if (fromVite) return fromVite;
  return __DEV__ ? "http://localhost:8081" : "https://facturacionelectronicatt.tecnotics.co";
}

function resolveEnvKey(expoKey: string, extraKey: keyof ExpoExtra): string {
  if (expoKey === "EXPO_PUBLIC_EPAYCO_PUBLIC_KEY") {
    return (
      stripUrl(process.env.EXPO_PUBLIC_EPAYCO_PUBLIC_KEY) ||
      stripUrl(readExtra().epaycoPublicKey) ||
      stripUrl(process.env.VITE_APP_EPAYCO_PUBLIC_KEY)
    );
  }
  if (expoKey === "EXPO_PUBLIC_EPAYCO_CUSTOMER_ID") {
    return (
      stripUrl(process.env.EXPO_PUBLIC_EPAYCO_CUSTOMER_ID) ||
      stripUrl(readExtra().epaycoCustomerId) ||
      stripUrl(process.env.VITE_APP_EPAYCO_CUSTOMER_ID)
    );
  }
  return stripUrl(readExtra()[extraKey]);
}

/** URLs del back — leídas por Expo (EXPO_PUBLIC_* + app.config.js extra). */
export const ENV = {
  API_URL: resolveApiUrl(),
  FE_URL: resolveFeUrl(),
  EPAYCO_PUBLIC_KEY: resolveEnvKey("EXPO_PUBLIC_EPAYCO_PUBLIC_KEY", "epaycoPublicKey"),
  EPAYCO_CUSTOMER_ID: resolveEnvKey("EXPO_PUBLIC_EPAYCO_CUSTOMER_ID", "epaycoCustomerId"),
};

export const API_ROUTES = {
    // ============================================
    // AUTENTICACIÓN
    // ============================================
    LOGIN: ENV.API_URL + "/auth/signin",
    LOGIN_VERIFY_2FA: ENV.API_URL + "/auth/signin/verify-2fa",
    LOGIN_RESEND_2FA: ENV.API_URL + "/auth/signin/resend-2fa",
    COMPANY_PASSWORD_FORGOT: ENV.API_URL + "/auth/password/forgot",
    COMPANY_PASSWORD_RESET: ENV.API_URL + "/auth/password/reset",
    LOGOUT: ENV.API_URL + "/auth/signout",
    VALIDATE_SESSION: ENV.API_URL + "/auth/me",
    WHOAMI: ENV.API_URL + "/auth/whoami",

    CONTADOR_SIGNIN: ENV.API_URL + "/contador/signin",
    CONTADOR_VERIFY_2FA: ENV.API_URL + "/contador/verify-2fa",
    CONTADOR_SELECT_COMPANY: ENV.API_URL + "/contador/select-company",

    GET_PROFILE: ENV.API_URL + "/company/get-info",
    UPDATE_COMPANY_INFO: ENV.API_URL + "/company/info",
    COMPANY_PREFIXES: ENV.API_URL + "/company/prefixes",
    COMPANY_NOMINA_PREFIXES: ENV.API_URL + "/company/nomina-prefixes",
    COMPANY_PREFIXES_DEFAULT: ENV.API_URL + "/company/prefixes/default",
    COMPANY_PREFIXES_STATUS: ENV.API_URL + "/company/prefixes/status",
    COMPANY_SIMBA_HABILITAR_FE: ENV.API_URL + "/company/simba/habilitar-fe",
    COMPANY_SIMBA_HABILITAR_POS: ENV.API_URL + "/company/simba/habilitar-pos",
    COMPANY_SIMBA_HABILITAR_NE: ENV.API_URL + "/company/simba/habilitar-ne",
    COMPANY_SIMBA_NUMBERING_RANGE: ENV.API_URL + "/company/simba/numbering-range",
    COMPANY_SUBSCRIPTION: ENV.API_URL + "/company/subscription",

    // ============================================
    // REGISTRO DE EMPRESA (4 PASOS)
    // ============================================
    SIGNUP_STEP1: ENV.API_URL + "/company/signup/step1",
    SIGNUP_STEP2_VERIFY_OTP: ENV.API_URL + "/company/signup/step2/verify-otp",
    SIGNUP_STEP3_UPLOAD_DOCS: ENV.API_URL + "/company/signup/step3/upload-legal-docs",
    SIGNUP_STEP4_SEND_TO_SIMBA: ENV.API_URL + "/company/signup/step4/send-to-simba",
    /** POST multipart: companyId + signed_contrato_mandato (file) */
    UPLOAD_SIGNED_MANDATO: ENV.API_URL + "/company/signup/upload-signed-mandato",
    /** GET contrato mandato para pantalla de firma (companyId de la URL) */
    SIGNUP_CONTRATO_MANDATO: (companyId: string) => ENV.API_URL + `/company/signup/contrato-mandato/${encodeURIComponent(companyId)}`,

    // ============================================
    // ITEMS (Productos/Servicios)
    // ============================================
    ITEMS: ENV.API_URL + "/items",
    /** POST body: { codes: string[] } — devuelve ítems que coinciden con esos códigos */
    ITEMS_BY_CODE: ENV.API_URL + "/itemsbycode",
    ITEMS_SEARCH: ENV.API_URL + "/items/search",
    ITEMS_DELETE_MULTIPLE: ENV.API_URL + "/items/delete-multiple",
    ITEM_BY_ID: (itemId: string) => ENV.API_URL + `/items/${itemId}`,

    // ============================================
    // CLIENTES
    // ============================================
    CLIENTS: ENV.API_URL + "/clients",
    CLIENTS_SEARCH: ENV.API_URL + "/clients/search",
    CLIENT_BY_ID: (clientId: string) => ENV.API_URL + `/clients/${clientId}`,

    // ============================================
    // SUBUSUARIOS (cuenta empresa)
    // ============================================
    SUB_USERS: ENV.API_URL + "/sub-users",
    SUB_USERS_SEARCH: ENV.API_URL + "/sub-users/search",
    SUB_USER_BY_ID: (userId: string) => ENV.API_URL + `/sub-users/${userId}`,
    SUB_USER_AVATAR: (userId: string) => ENV.API_URL + `/sub-users/${userId}/avatar`,
    /** Buscar en la DIAN por número y tipo de documento (no requiere credenciales). smaid: 31 NIT, 13 CC, etc. */
    FIND_DIAN: (nit: string, smaid: string) => ENV.API_URL + `/find-dian?nit=${encodeURIComponent(nit)}&smaid=${encodeURIComponent(smaid)}`,

    // ============================================
    // FACTURAS
    // ============================================
    INVOICES: ENV.API_URL + "/invoices",
    INVOICE_BY_ID: (facturaId: string) => ENV.API_URL + `/invoices/${facturaId}`,
    INVOICE_DOWNLOAD: (facturaId: string) => ENV.API_URL + `/invoices/${facturaId}/download`,
    INVOICE_RESEND_EMAIL: (facturaId: string) => ENV.API_URL + `/invoices/${facturaId}/resend-email`,
    INVOICE_SUBMIT_DRAFT: (facturaId: string) => ENV.API_URL + `/invoices/${facturaId}/submit-draft`,
    INVOICE_DISCARD_DRAFT: (facturaId: string) => ENV.API_URL + `/invoices/${facturaId}/draft`,
    INVOICES_EXPORT_EXCEL: ENV.API_URL + "/invoices/export/excel",

    // ============================================
    // PLANTILLAS / FACTURAS RECURRENTES
    // ============================================
    /** Listado de facturas marcadas como plantilla (filtros: recurrence, cliente). */
    PLANTILLAS: ENV.API_URL + "/plantillas",
    /** Registrar que se facturó (recreó) desde una plantilla (reinicia recurrencia). */
    PLANTILLA_MARK_INVOICED: (facturaId: string) => ENV.API_URL + `/plantillas/${facturaId}/mark-invoiced`,
    /** Marcar/desmarcar una factura como plantilla (con recurrencia). */
    INVOICE_SET_TEMPLATE: (facturaId: string) => ENV.API_URL + `/invoices/${facturaId}/template`,

    // ============================================
    // REMISIONES (entrega firmada por el cliente)
    // ============================================
    REMISIONES: ENV.API_URL + "/remisiones",
    REMISION_BY_ID: (id: string) => ENV.API_URL + `/remisiones/${id}`,
    REMISION_SEND_EMAIL: (id: string) => ENV.API_URL + `/remisiones/${id}/send-email`,
    REMISION_DOWNLOAD: (id: string) => ENV.API_URL + `/remisiones/${id}/download`,
    /** ===== Vista pública (sin auth): el cliente ve/descarga/firma ===== */
    REMISION_PUBLIC_BY_SLUG: (slug: string) => ENV.API_URL + `/remisiones/public/${slug}`,
    REMISION_PUBLIC_DOWNLOAD: (slug: string) => ENV.API_URL + `/remisiones/public/${slug}/download`,
    REMISION_PUBLIC_SIGN: (slug: string) => ENV.API_URL + `/remisiones/public/${slug}/sign`,

    // ============================================
    // RECAUDOS / CARTERA (cuentas por cobrar)
    // ============================================
    /** Listado de facturas por cobrar (pendientes/parciales) con saldo. Filtros: status, cliente, vencidas. */
    RECAUDOS: ENV.API_URL + "/recaudos",
    /** Resumen de cartera (total por cobrar, vencido, etc.) para el encabezado. */
    RECAUDOS_SUMMARY: ENV.API_URL + "/recaudos/summary",
    /** Registrar un pago que cubre varias facturas (un solo comprobante). */
    RECAUDOS_BATCH_PAYMENT: ENV.API_URL + "/recaudos/batch-payment",
    /** Pagos/abonos de una factura: GET lista, POST registra un nuevo pago. */
    INVOICE_PAYMENTS: (facturaId: string) => ENV.API_URL + `/invoices/${facturaId}/payments`,
    /** Eliminar/anular un pago registrado de una factura. */
    INVOICE_PAYMENT_BY_ID: (facturaId: string, paymentId: string) =>
        ENV.API_URL + `/invoices/${facturaId}/payments/${paymentId}`,
    /** Comprobantes de ingreso (recibos de caja) de una factura. */
    INVOICE_RECEIPTS: (facturaId: string) => ENV.API_URL + `/invoices/${facturaId}/receipts`,
    /** Descargar PDF del comprobante de ingreso. */
    RECEIPT_DOWNLOAD: (receiptId: string) => ENV.API_URL + `/receipts/${receiptId}/download`,
    /** Enviar el comprobante de ingreso al cliente por correo. */
    RECEIPT_SEND_EMAIL: (receiptId: string) => ENV.API_URL + `/receipts/${receiptId}/send-email`,

    WIDGET_SESSION: ENV.API_URL + "/company/get-widget-sign-in",
    UPDATE_COMPANY_LOGO: ENV.API_URL + "/company/logo",

    // ============================================
    // COMPRAS Y GASTOS — Proveedores
    // ============================================
    SUPPLIERS: ENV.API_URL + "/suppliers",
    SUPPLIER_BY_ID: (id: string) => ENV.API_URL + `/suppliers/${id}`,

    // ============================================
    // COMPRAS Y GASTOS — Facturas importadas (XML/ZIP DIAN)
    // ============================================
    /** Importación manual de XML/ZIP. kind: "purchase" | "expense". POST multipart. */
    PURCHASES_IMPORT: (kind: string) => ENV.API_URL + `/purchases/${kind}/import`,
    PURCHASES_IMPORT_EXCEL: (kind: string) => ENV.API_URL + `/purchases/${kind}/import-excel`,
    /** Listado de compras/gastos importados. kind: "purchase" | "expense". */
    PURCHASES_LIST: (kind: string) => ENV.API_URL + `/purchases/${kind}`,
    PURCHASE_BY_ID: (id: string) => ENV.API_URL + `/purchase/${id}`,
    PURCHASE_PDF: (id: string) => ENV.API_URL + `/purchase/${id}/pdf`,
    PURCHASE_RETENTION_PREVIEW: (id: string) => ENV.API_URL + `/purchase/${id}/retenciones/preview`,
    PURCHASE_RETENTION_APPLY: (id: string) => ENV.API_URL + `/purchase/${id}/retenciones`,
    PURCHASE_RETENTION_GROUPED: (id: string) => ENV.API_URL + `/purchase/${id}/retenciones-agrupadas`,

    // ============================================
    // PRODUCTOS POR PROVEEDOR (parametrización contable + IA)
    // ============================================
    SUPPLIER_ITEMS: ENV.API_URL + "/supplier-items",
    SUPPLIER_ITEM_BY_ID: (id: string) => ENV.API_URL + `/supplier-items/${id}`,
    SUPPLIER_ITEM_SUGGEST: (id: string) => ENV.API_URL + `/supplier-items/${id}/suggest`,
    SUPPLIER_ITEM_APPLY_SUGGESTION: (id: string) => ENV.API_URL + `/supplier-items/${id}/apply-suggestion`,
    SUPPLIER_ITEM_LESSONS: ENV.API_URL + "/supplier-items/lessons",
    SUPPLIER_ITEM_LESSON_BY_ID: (id: string) => ENV.API_URL + `/supplier-items/lessons/${id}`,

    // ============================================
    // TESORERÍA (pago a proveedores)
    // ============================================
    TREASURY_ACH_CATALOG: ENV.API_URL + "/treasury/ach-catalog",
    TREASURY_BANKS: ENV.API_URL + "/treasury/banks",
    TREASURY_BANK_BY_ID: (id: string) => ENV.API_URL + `/treasury/banks/${id}`,
    /** Facturas por pagar (pendientes/parciales). */
    TREASURY_PAYABLE: ENV.API_URL + "/treasury/payable",
    TREASURY_PAYABLE_SUPPLIERS: ENV.API_URL + "/treasury/payable-suppliers",
    /** Lotes de pago. */
    TREASURY_BATCHES: ENV.API_URL + "/treasury/batches",
    TREASURY_BATCH_BY_ID: (id: string) => ENV.API_URL + `/treasury/batches/${id}`,
    TREASURY_BATCH_DOWNLOAD: (id: string) => ENV.API_URL + `/treasury/batches/${id}/download`,
    TREASURY_BATCH_SENT: (id: string) => ENV.API_URL + `/treasury/batches/${id}/sent`,
    TREASURY_BATCH_RECONCILE: (id: string) => ENV.API_URL + `/treasury/batches/${id}/reconcile`,
    TREASURY_BATCH_COMPROBANTES: (id: string) => ENV.API_URL + `/treasury/batches/${id}/comprobantes`,
    // Conciliación asistida (movimientos puente → clientes/proveedores)
    TREASURY_BANKCONC_PENDING: ENV.API_URL + "/treasury/bank-conciliation/pending",
    TREASURY_BANKCONC_DOCUMENTS: ENV.API_URL + "/treasury/bank-conciliation/documents",
    TREASURY_BANKCONC_APPLY: ENV.API_URL + "/treasury/bank-conciliation/apply",
    TREASURY_BANKCONC_APPLY_MULTIPLE: ENV.API_URL + "/treasury/bank-conciliation/apply-multiple",
    TREASURY_BANKCONC_APPLY_MULTIPLE_PURCHASES: ENV.API_URL + "/treasury/bank-conciliation/apply-multiple-purchases",
    TREASURY_BANKCONC_APPLY_BATCH: ENV.API_URL + "/treasury/bank-conciliation/apply-batch",
    TREASURY_BANKCONC_APPLY_ALL: ENV.API_URL + "/treasury/bank-conciliation/apply-all-suggested",
    TREASURY_BANKCONC_APPLY_ACCOUNT: ENV.API_URL + "/treasury/bank-conciliation/apply-account",
    // Conciliación bancaria (extracto vs libros)
    TREASURY_RECONS: ENV.API_URL + "/treasury/reconciliations",
    TREASURY_RECON_BY_ID: (id: string) => ENV.API_URL + `/treasury/reconciliations/${id}`,
    TREASURY_RECON_SUMMARY: (id: string) => ENV.API_URL + `/treasury/reconciliations/${id}/summary`,
    TREASURY_RECON_MATCH: (id: string) => ENV.API_URL + `/treasury/reconciliations/${id}/match`,
    TREASURY_RECON_CONCILIATORIAS: (id: string) => ENV.API_URL + `/treasury/reconciliations/${id}/conciliatorias`,
    TREASURY_RECON_ADJUSTMENT: (id: string) => ENV.API_URL + `/treasury/reconciliations/${id}/adjustment`,
    TREASURY_RECON_CLOSE: (id: string) => ENV.API_URL + `/treasury/reconciliations/${id}/close`,
    TREASURY_RECON_IMPORT_PDF: ENV.API_URL + "/treasury/reconciliations/import-pdf",
    TREASURY_RECON_POST_STATEMENTS: ENV.API_URL + "/treasury/reconciliations/post-statements",
    TREASURY_STMT_GENERIC_PREVIEW: ENV.API_URL + "/treasury/statement/generic-preview",
    TREASURY_STMT_GENERIC_IMPORT: ENV.API_URL + "/treasury/statement/generic-import",
    TREASURY_STMT_GENERIC_POST: ENV.API_URL + "/treasury/statement/generic-post",
    TREASURY_STMT_PROFILES: ENV.API_URL + "/treasury/statement/profiles",
    TREASURY_STMT_PROFILE_BY_ID: (id: string) => ENV.API_URL + `/treasury/statement/profiles/${id}`,

    CONC2_GENERATE: ENV.API_URL + "/treasury/conciliacion/generate",
    CONC2_MOVEMENTS: ENV.API_URL + "/treasury/conciliacion/movements",
    CONC2_DOCUMENTS: ENV.API_URL + "/treasury/conciliacion/documents",
    CONC2_SEARCH_TERCEROS: ENV.API_URL + "/treasury/conciliacion/search-terceros",
    CONC2_LIST: ENV.API_URL + "/treasury/conciliacion/list",
    CONC2_CONFIRM: ENV.API_URL + "/treasury/conciliacion/confirm",
    CONC2_CONFIRM_BATCH: ENV.API_URL + "/treasury/conciliacion/confirm-batch",
    CONC2_REJECT: ENV.API_URL + "/treasury/conciliacion/reject",
    CONC2_MANUAL: ENV.API_URL + "/treasury/conciliacion/manual",
    CONC2_SIMILAR: ENV.API_URL + "/treasury/conciliacion/similar",
    CONC2_RECURRING: ENV.API_URL + "/treasury/conciliacion/recurring",
    CONC2_CARTERA: ENV.API_URL + "/treasury/conciliacion/cartera",
    CONC2_CARTERA_CLIENTE: ENV.API_URL + "/treasury/conciliacion/cartera-cliente",
    CONC2_CXP: ENV.API_URL + "/treasury/conciliacion/cxp",
    CONC2_CXP_PROVEEDOR: ENV.API_URL + "/treasury/conciliacion/cxp-proveedor",
    CONC2_PAGAR_PROVEEDOR: ENV.API_URL + "/treasury/conciliacion/pagar-proveedor",
    CONC2_RECAUDAR_CLIENTE: ENV.API_URL + "/treasury/conciliacion/recaudar-cliente",
    CONC2_BOLSA: ENV.API_URL + "/treasury/conciliacion/bolsa",
    CONC2_BOLSA_RECLASIFICAR: ENV.API_URL + "/treasury/conciliacion/bolsa/reclasificar",
    CONC2_AUDITAR: ENV.API_URL + "/treasury/conciliacion/auditar",
    CONC2_SUGGEST_ACCOUNT: ENV.API_URL + "/treasury/conciliacion/suggest-account",
    CONC2_CREATE_ACCOUNT: ENV.API_URL + "/treasury/conciliacion/create-account",
    CONC2_TO_ACCOUNT: ENV.API_URL + "/treasury/conciliacion/to-account",
    CONC2_JOBS: ENV.API_URL + "/treasury/conciliacion/jobs",
    CONC2_JOBS_RESUME: ENV.API_URL + "/treasury/conciliacion/jobs/resume",
    CONC2_ANTICIPO: ENV.API_URL + "/treasury/conciliacion/anticipo",

    // ============================================
    // CONTABILIDAD / CONFIGURACIÓN CONTABLE
    // ============================================
    ACCOUNTING_CONFIG: ENV.API_URL + "/accounting/config",
    ACCOUNTING_SEQUENCE: (type: string) => ENV.API_URL + `/accounting/sequences/${type}`,
    ACCOUNTING_SEQUENCE_BLOCK: (type: string) => ENV.API_URL + `/accounting/sequences/${type}/block-range`,
    ACCOUNTING_COST_CENTERS: ENV.API_URL + "/accounting/cost-centers",
    ACCOUNTING_COST_CENTER_BY_ID: (id: string) => ENV.API_URL + `/accounting/cost-centers/${id}`,
    ACCOUNTING_COST_CENTERS_IMPORT: ENV.API_URL + "/accounting/cost-centers/import",
    ACCOUNTING_COA: ENV.API_URL + "/accounting/coa",
    ACCOUNTING_COA_IMPORT: ENV.API_URL + "/accounting/coa/import",
    ACCOUNTING_COA_IMPORT_TEMPLATE: ENV.API_URL + "/accounting/coa/import-template",
    ACCOUNTING_BOOTSTRAP: ENV.API_URL + "/accounting/bootstrap",
    ACCOUNTING_BOOTSTRAP_TEST_DATA: ENV.API_URL + "/accounting/bootstrap-test-data",
    ACCOUNTING_PERMISSIONS: ENV.API_URL + "/accounting/permissions",
    ACCOUNTING_ROLES: ENV.API_URL + "/accounting/roles",
    ACCOUNTING_ROLES_SEED: ENV.API_URL + "/accounting/roles/seed-defaults",
    ACCOUNTING_ROLE_BY_ID: (id: string) => ENV.API_URL + `/accounting/roles/${id}`,
    ACCOUNTING_UVT: ENV.API_URL + "/accounting/uvt",
    ACCOUNTING_RETENTIONS: ENV.API_URL + "/accounting/retentions",
    ACCOUNTING_RETENTION_BY_ID: (id: string) => ENV.API_URL + `/accounting/retentions/${id}`,

    // ============================================
    // CONTABILIDAD — Comprobantes (libro mayor / diario)
    // ============================================
    LEDGER_ENTRIES: ENV.API_URL + "/ledger/entries",
    LEDGER_ENTRIES_EXPORT: ENV.API_URL + "/ledger/entries/export",
    LEDGER_ENTRY_BY_ID: (id: string) => ENV.API_URL + `/ledger/entries/${id}`,
    LEDGER_ENTRY_POST: (id: string) => ENV.API_URL + `/ledger/entries/${id}/post`,
    LEDGER_ENTRY_ANNUL: (id: string) => ENV.API_URL + `/ledger/entries/${id}/annul`,
    LEDGER_JOURNAL: ENV.API_URL + "/ledger/journal",
    LEDGER_PERIODS: ENV.API_URL + "/ledger/periods",
    LEDGER_TRIAL_BALANCE: ENV.API_URL + "/ledger/reports/trial-balance",
    LEDGER_GENERAL_LEDGER: ENV.API_URL + "/ledger/reports/general-ledger",
    LEDGER_ACCOUNT_DETAIL: ENV.API_URL + "/ledger/reports/account-detail",
    LEDGER_THIRD_PARTY: ENV.API_URL + "/ledger/reports/third-party",
    LEDGER_FINANCIAL: ENV.API_URL + "/ledger/reports/financial-statements",
    LEDGER_OPENING: ENV.API_URL + "/ledger/opening",
    LEDGER_CLOSING_STATUS: ENV.API_URL + "/ledger/closing-status",
    LEDGER_CLOSE_YEAR: ENV.API_URL + "/ledger/close-year",
    LEDGER_REOPEN_YEAR: ENV.API_URL + "/ledger/reopen-year",
    LEDGER_DIAN_RET_PARTIES: ENV.API_URL + "/ledger/dian/retention-parties",
    LEDGER_DIAN_RET_CERT: ENV.API_URL + "/ledger/dian/retention-certificate",
    LEDGER_DIAN_EXOGENA: ENV.API_URL + "/ledger/dian/exogena",
    LEDGER_DIAN_EXOGENA_VALIDACION: ENV.API_URL + "/ledger/dian/exogena/validacion",
    LEDGER_DIAN_EXOGENA_XML: ENV.API_URL + "/ledger/dian/exogena/xml",
    LEDGER_DIAN_ICA_MUNICIPIO: ENV.API_URL + "/ledger/dian/ica-municipio",
    // Ajustes contables periódicos (diferidos, provisiones, diferencia en cambio)
    LEDGER_ADJ_AMORTIZE: ENV.API_URL + "/ledger/adjustments/amortize-deferrals",
    LEDGER_ADJ_PROVISION: ENV.API_URL + "/ledger/adjustments/provision-monthly",
    LEDGER_ADJ_EXCHANGE: ENV.API_URL + "/ledger/adjustments/exchange-revaluation",
    LEDGER_INTEGRITY: ENV.API_URL + "/ledger/integrity",
    LEDGER_BUDGET: ENV.API_URL + "/ledger/budget",
    LEDGER_BUDGET_EXECUTION: ENV.API_URL + "/ledger/budget/execution",
    LEDGER_BUDGET_BY_ID: (id: string) => ENV.API_URL + `/ledger/budget/${id}`,
    LEDGER_NOTES: ENV.API_URL + "/ledger/notes",
    LEDGER_NOTES_SEED: ENV.API_URL + "/ledger/notes/seed",
    LEDGER_NOTE_BY_ID: (id: string) => ENV.API_URL + `/ledger/notes/${id}`,
    LEDGER_CONCILIACION_FISCAL: ENV.API_URL + "/ledger/conciliacion-fiscal",
    LEDGER_TRM: ENV.API_URL + "/ledger/trm",
    LEDGER_TRM_AT: ENV.API_URL + "/ledger/trm/at",

    // ============================================
    // ACTIVOS FIJOS
    // ============================================
    FIXED_ASSETS: ENV.API_URL + "/fixed-assets",
    FIXED_ASSET_BY_ID: (id: string) => ENV.API_URL + `/fixed-assets/${id}`,
    FIXED_ASSETS_IMPORT: ENV.API_URL + "/fixed-assets/import",
    FIXED_ASSETS_DEPRECIATE: ENV.API_URL + "/fixed-assets/depreciate",
    FIXED_ASSET_DISPOSE: (id: string) => ENV.API_URL + `/fixed-assets/${id}/dispose`,

    // ============================================
    // TERCEROS (maestro unificado)
    // ============================================
    TERCEROS: ENV.API_URL + "/terceros",
    TERCERO_BY_ID: (id: string) => ENV.API_URL + `/terceros/${id}`,
    TERCEROS_MIGRATE: ENV.API_URL + "/terceros/migrate",
    TERCEROS_BACKFILL: ENV.API_URL + "/terceros/backfill",

    // ============================================
    // COTIZACIONES (documento de venta no fiscal)
    // ============================================
    QUOTES: ENV.API_URL + "/quotes",
    /** Búsqueda: el backend filtra por ?cliente= dentro de /quotes (no hay endpoint /search aparte) */
    QUOTES_SEARCH: ENV.API_URL + "/quotes",
    QUOTE_BY_ID: (quoteId: string) => ENV.API_URL + `/quotes/${quoteId}`,
    /** Enviar la cotización por correo al cliente (PDF + link público) */
    QUOTE_SEND_EMAIL: (quoteId: string) => ENV.API_URL + `/quotes/${quoteId}/send-email`,
    /** Descargar PDF (base64) de la cotización */
    QUOTE_DOWNLOAD: (quoteId: string) => ENV.API_URL + `/quotes/${quoteId}/download`,
    /** Convertir cotización aceptada en factura */
    QUOTE_CONVERT_TO_INVOICE: (quoteId: string) => ENV.API_URL + `/quotes/${quoteId}/convert-to-invoice`,
    /** ===== Vista pública (sin auth): el cliente ve/descarga/aprueba por el link ===== */
    QUOTE_PUBLIC_BY_SLUG: (slug: string) => ENV.API_URL + `/quotes/public/${slug}`,
    QUOTE_PUBLIC_DOWNLOAD: (slug: string) => ENV.API_URL + `/quotes/public/${slug}/download`,
    QUOTE_PUBLIC_APPROVE: (slug: string) => ENV.API_URL + `/quotes/public/${slug}/approve`,

    // ============================================
    // EMPLEADOS (para Nómina Electrónica)
    // ============================================
    EMPLEADOS: ENV.API_URL + "/empleados",
    EMPLEADO_BY_ID: (empleadoId: string) => ENV.API_URL + `/empleados/${empleadoId}`,

    // ============================================
    // NÓMINA ELECTRÓNICA
    // ============================================
    NOMINA: ENV.API_URL + "/nomina",
    NOMINA_LOTE: ENV.API_URL + "/nomina/lote",
    NOMINA_LOTES: ENV.API_URL + "/nomina/lotes",
    NOMINA_PLANTILLA: ENV.API_URL + "/nomina/lote/plantilla",
    NOMINA_BY_PERIODO: (periodoKey: string) => ENV.API_URL + `/nomina/periodo/${periodoKey}`,
    NOMINA_REPLACE: ENV.API_URL + "/nomina/replace",
    NOMINA_DELETE: ENV.API_URL + "/nomina/delete",
    NOMINA_BY_ID: (nominaId: string) => ENV.API_URL + `/nomina/${nominaId}`,
    NOMINA_CERT_EMPLEADOS: ENV.API_URL + "/nomina/certificados/empleados",
    NOMINA_CERT_FORM220: ENV.API_URL + "/nomina/certificados/form220",
    NOMINA_PILA_PREVIEW: ENV.API_URL + "/nomina/pila/preview",
    NOMINA_PILA_GENERAR: ENV.API_URL + "/nomina/pila/generar",
    NOMINA_PILA_HISTORIAL: ENV.API_URL + "/nomina/pila/historial",
    NOMINA_PILA_BY_PERIODO: (periodo: string) => ENV.API_URL + `/nomina/pila/${periodo}`,
    NOMINA_PILA_DOWNLOAD: (periodo: string) => ENV.API_URL + `/nomina/pila/${periodo}/download`,

    // ============================================
    // LOGGER (auditoría por tenant)
    // ============================================
    LOGGER: ENV.API_URL + "/logger",

    // ============================================
    // ESTADÍSTICAS (dashboard tipo Power BI)
    // ============================================
    COMPANY_STATISTICS: ENV.API_URL + "/company/statistics",

    // Inventario (existencias, kardex, bodegas)
    INVENTORY_WAREHOUSES: ENV.API_URL + "/inventory/warehouses",
    INVENTORY_WAREHOUSE_BY_ID: (id: string) => ENV.API_URL + `/inventory/warehouses/${id}`,
    INVENTORY_STOCK: ENV.API_URL + "/inventory/stock",
    INVENTORY_VALORIZADO: ENV.API_URL + "/inventory/valorizado",
    INVENTORY_KARDEX: (itemId: string) => ENV.API_URL + `/inventory/kardex/${itemId}`,
    INVENTORY_AJUSTE: ENV.API_URL + "/inventory/movements/ajuste",
    INVENTORY_TRASLADO: ENV.API_URL + "/inventory/movements/traslado",
    INVENTORY_SALDOS_INICIALES: ENV.API_URL + "/inventory/saldos-iniciales",

    // Analítica financiera (libro mayor, con filtro ?from&to)
    ANALYTICS_EXECUTIVE: ENV.API_URL + "/analytics/executive-summary",
    ANALYTICS_PL_MONTHLY: ENV.API_URL + "/analytics/pl-monthly",
    ANALYTICS_CASHFLOW: ENV.API_URL + "/analytics/cashflow-monthly",
    ANALYTICS_IVA: ENV.API_URL + "/analytics/iva",
    ANALYTICS_RETENCIONES: ENV.API_URL + "/analytics/retenciones",
    ANALYTICS_DSO_DPO: ENV.API_URL + "/analytics/dso-dpo",
    ANALYTICS_TOP_PRODUCTOS: ENV.API_URL + "/analytics/top-productos",
    ANALYTICS_PAYROLL: ENV.API_URL + "/analytics/payroll",
    ANALYTICS_ASSETS: ENV.API_URL + "/analytics/assets",
    ANALYTICS_PROJECTION: ENV.API_URL + "/analytics/projection",
    ANALYTICS_SCORING: ENV.API_URL + "/analytics/scoring",
    ANALYTICS_ALERTS: ENV.API_URL + "/analytics/alerts",
    ANALYTICS_CASHFLOW_PROJ: ENV.API_URL + "/analytics/cashflow-projection",
    ANALYTICS_PENDING: ENV.API_URL + "/analytics/pending-docs",

    // Reportes de gestión/comerciales (con filtro de fechas ?from&to)
    REPORT_CARTERA_AGING: ENV.API_URL + "/reports/cartera-aging",
    REPORT_CXP_AGING: ENV.API_URL + "/reports/cxp-aging",
    REPORT_TOP_CLIENTES: ENV.API_URL + "/reports/top-clientes",
    REPORT_TOP_PROVEEDORES: ENV.API_URL + "/reports/top-proveedores",
    REPORT_VENTAS_COMPRAS_GASTOS: ENV.API_URL + "/reports/ventas-compras-gastos",
    REPORT_RECAUDO_FORMA_PAGO: ENV.API_URL + "/reports/recaudo-forma-pago",
    REPORT_EMBUDO_COTIZACIONES: ENV.API_URL + "/reports/embudo-cotizaciones",

    /** Pista de auditoría estructurada (quién/cuándo/qué) con filtros. */
    AUDIT: ENV.API_URL + "/audit",
    /** Soportes adjuntos por documento (entidad + id). */
    ATTACHMENTS: (entidad: string, entidadId: string) => ENV.API_URL + `/attachments/${entidad}/${entidadId}`,
    ATTACHMENT_BY_ID: (id: string) => ENV.API_URL + `/attachments/${id}`,

    // ============================================
    // SUPERADMIN (panel /admin)
    // ============================================
    ADMIN_SIGNIN: ENV.API_URL + "/admin/auth/signin",
    ADMIN_SIGNIN_VERIFY_2FA: ENV.API_URL + "/admin/auth/signin/verify-2fa",
    ADMIN_SIGNIN_RESEND_2FA: ENV.API_URL + "/admin/auth/signin/resend-2fa",
    ADMIN_PASSWORD_FORGOT: ENV.API_URL + "/admin/auth/password/forgot",
    ADMIN_PASSWORD_RESET: ENV.API_URL + "/admin/auth/password/reset",
    ADMIN_ME: ENV.API_URL + "/admin/auth/me",
    ADMIN_SIGNOUT: ENV.API_URL + "/admin/auth/signout",
    ADMIN_CONTADORES: ENV.API_URL + "/admin/contadores",
    ADMIN_CONTADOR_BY_ID: (id: string) => ENV.API_URL + `/admin/contadores/${id}`,
    ADMIN_COMPANIES: ENV.API_URL + "/admin/companies",
    ADMIN_COMPANY_DETAIL: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}`,
    ADMIN_COMPANY_SUBSCRIPTION: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/subscription`,
    ADMIN_COMPANY_SUBUSERS: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/sub-users`,
    ADMIN_COMPANY_INVOICES: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/invoices`,
    ADMIN_COMPANY_CLIENTS: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/clients`,
    ADMIN_COMPANY_ITEMS: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/items`,
    ADMIN_COMPANY_PREFIXES: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/prefixes`,
    ADMIN_COMPANY_PREFIX_DEFAULT: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/prefixes/default`,
    ADMIN_COMPANY_PREFIX_STATUS: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/prefixes/status`,
    ADMIN_COMPANY_PREFIX_DELETE: (companyId: string, prefix: string) => ENV.API_URL + `/admin/companies/${companyId}/prefixes/${encodeURIComponent(prefix)}`,
    ADMIN_COMPANY_ACTIVE: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/active`,
    ADMIN_COMPANY_RESET_PASSWORD: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/reset-password`,
    ADMIN_SUBUSER_RESET_PASSWORD: (userId: string) => ENV.API_URL + `/admin/sub-users/${userId}/reset-password`,
    ADMIN_ADMINS: ENV.API_URL + "/admin/admins",
    ADMIN_PLANS: ENV.API_URL + "/admin/plans",
    ADMIN_PLAN_BY_ID: (planId: string) => ENV.API_URL + `/admin/plans/${planId}`,
    ADMIN_COMPANY_CLIENT_DELETE: (companyId: string, clientId: string) => ENV.API_URL + `/admin/companies/${companyId}/clients/${clientId}`,
    ADMIN_COMPANY_ITEM_DELETE: (companyId: string, itemId: string) => ENV.API_URL + `/admin/companies/${companyId}/items/${itemId}`,
    ADMIN_COMPANY_SUBUSERS_CREATE: (companyId: string) => ENV.API_URL + `/admin/companies/${companyId}/sub-users`,
    ADMIN_SUBUSER_BY_ID: (userId: string) => ENV.API_URL + `/admin/sub-users/${userId}`,

    // ============================================
    // SINCRONIZACIÓN DIAN (automatización del portal)
    // ============================================
    DIAN_CREDENTIALS: ENV.API_URL + "/v1/dian/credentials",
    DIAN_CREDENTIAL_REFRESH_TOKEN: (id: string) => ENV.API_URL + `/v1/dian/credentials/${id}/refresh-token`,
    DIAN_CREDENTIAL_RESPONSIBLE: (id: string) => ENV.API_URL + `/v1/dian/credentials/${id}/responsible`,
    DIAN_CREDENTIAL_VALIDATE: (id: string) => ENV.API_URL + `/v1/dian/credentials/${id}/validate`,
    DIAN_CREDENTIAL_BY_ID: (id: string) => ENV.API_URL + `/v1/dian/credentials/${id}`,
    DIAN_STATUS: ENV.API_URL + "/v1/dian/status",

    DIAN_SYNC: ENV.API_URL + "/v1/dian/sync",
    DIAN_SYNC_BY_ID: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}`,
    DIAN_SYNC_EXCEL: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/excel`,
    DIAN_SYNC_DOCUMENTS: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/documents`,
    DIAN_SYNC_DOWNLOAD_PDFS: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/download-pdfs`,
    DIAN_SYNC_ENRICH: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/enrich`,
    DIAN_SYNC_RETRY_PDFS: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/retry-pdfs`,
    DIAN_SYNC_CANCEL: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/cancel`,
    DIAN_IMPORT_EXCEL: ENV.API_URL + "/v1/dian/import-excel",

    DIAN_DOCUMENT_PDF: (id: string) => ENV.API_URL + `/v1/dian/documents/${id}/pdf`,

    DIAN_EVENTS: ENV.API_URL + "/v1/dian/events",
    DIAN_LOGS: ENV.API_URL + "/v1/dian/logs",

    DIAN_RECONCILE: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/reconcile`,
    DIAN_RECONCILE_SUMMARY: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/reconciliation-summary`,
    DIAN_RECONCILIATIONS: ENV.API_URL + "/v1/dian/reconciliations",
    DIAN_RECONCILIATION_IMPORT: (id: string) => ENV.API_URL + `/v1/dian/reconciliations/${id}/import`,
    DIAN_RECONCILIATION_IMPORT_BULK: ENV.API_URL + "/v1/dian/reconciliations/import-bulk",
    DIAN_RECONCILE_SALES: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/reconcile-sales`,
    DIAN_RECONCILE_SALES_SUMMARY: (id: string) => ENV.API_URL + `/v1/dian/sync/${id}/sales-reconciliation-summary`,
    DIAN_SALES_RECONCILIATIONS: ENV.API_URL + "/v1/dian/sales-reconciliations",
    DIAN_SALES_RECONCILIATION_IMPORT: (id: string) => ENV.API_URL + `/v1/dian/sales-reconciliations/${id}/import`,
    DIAN_SALES_RECONCILIATION_IMPORT_BULK: ENV.API_URL + "/v1/dian/sales-reconciliations/import-bulk",
    PURCHASE_SET_KIND: (id: string) => ENV.API_URL + `/purchase/${id}/kind`,

    // Asistente virtual TEC (IA)
    TEC_MESSAGE: ENV.API_URL + "/v1/tec/message",
    TEC_SEND_BY_EMAIL: ENV.API_URL + "/v1/tec/send-by-email",
    TEC_CONVERSATIONS: ENV.API_URL + "/v1/tec/conversations",
    TEC_CONVERSATION_BY_ID: (id: string) => ENV.API_URL + `/v1/tec/conversation/${id}`,

    TAX_CALENDAR: ENV.API_URL + "/tax/calendar",
    TAX_PROFILE: ENV.API_URL + "/tax/profile",
    TAX_DEADLINES: ENV.API_URL + "/tax/deadlines",
};
