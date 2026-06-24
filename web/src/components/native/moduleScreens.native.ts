import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { COMPANY_MENU, type MenuItem } from "../shared/nav/menu.config";
import { PATHS } from "../../router/paths.contants";
import { remixToIonicon } from "../mobile/mobileNavIcons.native";

type IonName = ComponentProps<typeof Ionicons>["name"];

export type ModuleScreenConfig = {
  title: string;
  section: string;
  icon: IonName;
  description: string;
  highlights: string[];
};

const ADMIN_MODULES: Array<{ path: string; config: Omit<ModuleScreenConfig, "section"> }> = [
  {
    path: PATHS.ADMIN_HOME,
    config: {
      title: "Empresas",
      icon: "business-outline",
      description: "Listado y administración de empresas registradas en la plataforma.",
      highlights: ["Búsqueda", "Estado de cuenta", "Detalle por empresa"],
    },
  },
  {
    path: PATHS.ADMIN_PLANS,
    config: {
      title: "Planes",
      icon: "pricetag-outline",
      description: "Gestión de planes comerciales y límites por empresa.",
      highlights: ["Crear planes", "Precios", "Características"],
    },
  },
  {
    path: PATHS.ADMIN_ADMINS,
    config: {
      title: "Administradores",
      icon: "shield-outline",
      description: "Usuarios super administradores del panel global.",
      highlights: ["Altas", "Permisos", "Auditoría"],
    },
  },
];

const EXTRA_MODULES: Array<{ path: string; section: string; config: Omit<ModuleScreenConfig, "section"> }> = [
  {
    path: PATHS.MY_PROFILE,
    section: "Cuenta",
    config: {
      title: "Mi perfil",
      icon: "person-outline",
      description: "Datos de la empresa, logo, documentos y preferencias de tu cuenta.",
      highlights: ["Datos de contacto", "Logo y branding", "Documentos legales"],
    },
  },
  {
    path: PATHS.CONFIGURATION,
    section: "Cuenta",
    config: {
      title: "Configuración",
      icon: "settings-outline",
      description: "Facturación, documentos, eventos DIAN, usuarios y parámetros contables.",
      highlights: ["Prefijos y resoluciones", "Usuarios y roles", "PUC e impuestos"],
    },
  },
  {
    path: PATHS.SUB_USERS,
    section: "Cuenta",
    config: {
      title: "Sub-usuarios",
      icon: "people-outline",
      description: "Administra usuarios adicionales con permisos limitados en tu empresa.",
      highlights: ["Crear usuarios", "Asignar roles", "Control de acceso"],
    },
  },
  {
    path: PATHS.SALES_COTIZACIONES,
    section: "Ventas",
    config: {
      title: "Listado de cotizaciones",
      icon: "list-outline",
      description: "Revisa, envía y convierte cotizaciones en facturas o remisiones.",
      highlights: ["Historial de cotizaciones", "Envío por correo", "Conversión a factura"],
    },
  },
  {
    path: PATHS.BILLING_HISTORY,
    section: "Reportes",
    config: {
      title: "Histórico de facturación",
      icon: "time-outline",
      description: "Estadísticas e informes históricos de tu facturación electrónica.",
      highlights: ["Totales por periodo", "Exportación", "Análisis de emisión"],
    },
  },
];

const DESCRIPTIONS: Record<string, string> = {
  [PATHS.DOCUMENTS]:
    "Listado de facturas electrónicas emitidas. Filtra, exporta y gestiona acciones sobre cada documento.",
  [PATHS.SALES_RECAUDOS]:
    "Cartera y cuentas por cobrar. Registra pagos y da seguimiento a facturas pendientes.",
  [PATHS.SALES_COTIZACIONES_NUEVA]:
    "Crea cotizaciones comerciales y conviértelas en factura o remisión cuando el cliente apruebe.",
  [PATHS.SALES_REMISIONES]:
    "Documentos de entrega sin facturar. Firma digital y trazabilidad de despachos.",
  [PATHS.SALES_PLANTILLAS]:
    "Facturas recurrentes y plantillas para recrear documentos periódicos con un clic.",
  [PATHS.CLIENTS]:
    "Directorio de clientes con datos fiscales, contacto e historial comercial.",
  [PATHS.PURCHASES_SUPPLIERS]:
    "Agenda de proveedores con NIT, contacto y condiciones comerciales.",
  [PATHS.PURCHASES_COMPRAS]:
    "Facturas de compra importadas desde XML/ZIP de la DIAN y su causación contable.",
  [PATHS.PURCHASES_GASTOS]:
    "Comprobantes de gasto y documentos soporte para contabilidad y tesorería.",
  [PATHS.PURCHASES_PARAM]:
    "Parametrización contable de ítems por proveedor: cuentas, retenciones e IA.",
  [PATHS.PRODUCTS_SERVICES]:
    "Catálogo de productos y servicios con códigos, precios e impuestos.",
  [PATHS.TERCEROS]:
    "Maestro unificado de clientes, proveedores y empleados en un solo lugar.",
  [PATHS.TREASURY_PAGOS]:
    "Facturas por pagar a proveedores. Selecciona y genera lotes de pago.",
  [PATHS.TREASURY_LOTES]:
    "Historial de lotes de pago: generar, firmar y conciliar transferencias.",
  [PATHS.TREASURY_CONCILIACION]:
    "Concilia extractos bancarios contra movimientos contables y de tesorería.",
  [PATHS.TREASURY_BANCOS]:
    "Cuentas bancarias de la empresa usadas como origen de pagos.",
  [PATHS.NOMINA_EMPLEADOS]:
    "Empleados, nómina electrónica, liquidaciones y certificados laborales.",
  [PATHS.FIXED_ASSETS]:
    "Registro de activos fijos, depreciación lineal y bajas o ventas.",
  [PATHS.ANALYTICS]:
    "Panel de estadísticas financieras: ventas, rentabilidad, cartera y tributario.",
  [PATHS.DIAN_SYNC]:
    "Credenciales DIAN, sincronización de documentos, eventos y logs de integración.",
};

const ACCOUNTING_SECTIONS: Record<string, Omit<ModuleScreenConfig, "section">> = {
  comprobantes: {
    title: "Comprobantes",
    icon: "document-text-outline",
    description: "Crea y consulta comprobantes contables manuales y automáticos.",
    highlights: ["Asientos contables", "Plantillas", "Anulaciones"],
  },
  diario: {
    title: "Libro diario",
    icon: "book-outline",
    description: "Movimientos cronológicos del libro diario con filtros por periodo.",
    highlights: ["Consulta por fechas", "Exportación", "Detalle por cuenta"],
  },
  mayor: {
    title: "Mayor y balances",
    icon: "archive-outline",
    description: "Libro mayor y balances auxiliares por cuenta contable.",
    highlights: ["Saldos por cuenta", "Movimientos", "Terceros"],
  },
  balance: {
    title: "Balance de prueba",
    icon: "scale-outline",
    description: "Balance de prueba general y comparativo por periodos.",
    highlights: ["Saldos débito/crédito", "Cierre parcial", "Exportación"],
  },
  estados: {
    title: "Estados financieros",
    icon: "trending-up-outline",
    description: "Estado de resultados, balance general y flujo de efectivo.",
    highlights: ["Resultados del ejercicio", "Balance general", "Indicadores"],
  },
  saldos: {
    title: "Saldos iniciales",
    icon: "flag-outline",
    description: "Carga y ajuste de saldos iniciales por cuenta y tercero.",
    highlights: ["Apertura contable", "Importación", "Validación PUC"],
  },
  cierre: {
    title: "Cierre anual",
    icon: "lock-closed-outline",
    description: "Proceso de cierre contable anual y traslado de utilidades.",
    highlights: ["Cierre de cuentas", "Reapertura", "Auditoría"],
  },
  periodos: {
    title: "Períodos",
    icon: "calendar-outline",
    description: "Apertura y cierre de periodos contables mensuales.",
    highlights: ["Periodos abiertos", "Bloqueo", "Historial"],
  },
  dian: {
    title: "DIAN / Exógena",
    icon: "flag-outline",
    description: "Información exógena tributaria y reportes exigidos por la DIAN.",
    highlights: ["Formatos exógena", "Validación", "Exportación"],
  },
};

function defaultHighlights(section: string): string[] {
  return [
    `Módulo de ${section.toLowerCase()}`,
    "Misma funcionalidad que el portal web",
    "Datos sincronizados con tu empresa",
  ];
}

function buildFromMenu(): Map<string, ModuleScreenConfig> {
  const map = new Map<string, ModuleScreenConfig>();

  const walk = (items: MenuItem[], section: string) => {
    for (const item of items) {
      if (item.children) {
        walk(item.children, item.label);
        continue;
      }
      if (!item.path) continue;
      const key = item.path;
      const pathOnly = key.split("?")[0];
      map.set(key, {
        title: item.label,
        section,
        icon: remixToIonicon(item.icon),
        description:
          DESCRIPTIONS[pathOnly] ??
          DESCRIPTIONS[key] ??
          `Gestiona ${item.label.toLowerCase()} desde el portal de facturación.`,
        highlights: defaultHighlights(section),
      });
    }
  };

  walk(COMPANY_MENU, "General");

  for (const [sec, cfg] of Object.entries(ACCOUNTING_SECTIONS)) {
    map.set(`${PATHS.ACCOUNTING}?sec=${sec}`, { ...cfg, section: "Contabilidad" });
  }

  for (const extra of EXTRA_MODULES) {
    map.set(extra.path, { ...extra.config, section: extra.section });
  }

  for (const admin of ADMIN_MODULES) {
    map.set(admin.path, { ...admin.config, section: "Administración" });
  }

  const pagos = map.get(PATHS.TREASURY_PAGOS);
  if (pagos) map.set(PATHS.TREASURY, pagos);
  const compras = map.get(PATHS.PURCHASES_COMPRAS);
  if (compras) map.set(PATHS.PURCHASES, compras);

  return map;
}

export const MODULE_SCREEN_REGISTRY = buildFromMenu();

export function routeKey(pathname: string, search: string): string {
  const normalizedSearch = search.startsWith("?") ? search : search ? `?${search}` : "";
  if (pathname === PATHS.ACCOUNTING && normalizedSearch.includes("sec=")) {
    return `${pathname}${normalizedSearch}`;
  }
  return pathname;
}

export function getModuleScreenConfig(pathname: string, search: string): ModuleScreenConfig {
  const key = routeKey(pathname, search);
  const found = MODULE_SCREEN_REGISTRY.get(key);
  if (found) return found;

  if (pathname.startsWith("/documentos/")) {
    return {
      title: "Detalle de factura",
      section: "Ventas",
      icon: "document-text-outline",
      description: "Consulta el detalle, eventos DIAN y acciones de una factura específica.",
      highlights: ["PDF y XML", "Eventos DIAN", "Notas crédito/débito"],
    };
  }

  if (pathname.startsWith("/ventas/cotizaciones/") && pathname.endsWith("/editar")) {
    return {
      title: "Editar cotización",
      section: "Ventas",
      icon: "create-outline",
      description: "Editor completo de cotización con ítems, totales e impuestos.",
      highlights: ["Líneas de producto", "Descuentos", "Vista previa"],
    };
  }

  if (pathname.startsWith("/admin/empresas/")) {
    return {
      title: "Detalle de empresa",
      section: "Administración",
      icon: "business-outline",
      description: "Panel de administración de la empresa seleccionada.",
      highlights: ["Estado de cuenta", "Plan", "Configuración global"],
    };
  }

  return {
    title: "Módulo del portal",
    section: "Facturación",
    icon: "globe-outline",
    description: "Esta sección está disponible en el portal web de facturación electrónica.",
    highlights: defaultHighlights("Facturación"),
  };
}

export function getSiblingModules(pathname: string, search: string): ModuleScreenConfig[] {
  const current = getModuleScreenConfig(pathname, search);
  const siblings: ModuleScreenConfig[] = [];
  for (const cfg of MODULE_SCREEN_REGISTRY.values()) {
    if (cfg.section === current.section && cfg.title !== current.title) {
      siblings.push(cfg);
    }
  }
  return siblings.slice(0, 6);
}
