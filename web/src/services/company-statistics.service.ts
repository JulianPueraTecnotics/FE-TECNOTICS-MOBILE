import { API_ROUTES } from "../utils/global";

export interface PorEstado {
    estado: string;
    count: number;
}

export interface FacturaPorTipoDocumento {
    tipo: string;
    count: number;
    totalValorAPagar: number;
}

export interface FacturaPorMes {
    year: number;
    month: number;
    count: number;
    totalValorAPagar: number;
}

export interface FacturaPorPrefijo {
    prefijo: string;
    count: number;
    totalValorAPagar: number;
}

export interface FacturaPorMoneda {
    moneda: string;
    count: number;
    totalValorAPagar: number;
}

export interface FacturasStats {
    /** Documentos emitidos (sin borradores). */
    total: number;
    borradores: number;
    aprobadas: number;
    pendientes: number;
    rechazadas: number;
    enviadas: number;
    porEstado: PorEstado[];
    porTipoDocumento: FacturaPorTipoDocumento[];
    porMes: FacturaPorMes[];
    porPrefijo: FacturaPorPrefijo[];
    porMoneda: FacturaPorMoneda[];
    /** Facturado real: facturas de venta (tipo 01) aprobadas. */
    totalFacturado: number;
    totalNotasCredito: number;
    totalValorBruto: number;
}

export interface NominaPorMes {
    year: number;
    month: number;
    count: number;
    totalComprobante: number;
}

export interface NominaStats {
    total: number;
    borradores: number;
    aprobadas: number;
    empleados: number;
    totalComprobante: number;
    porEstado: PorEstado[];
    porMes: NominaPorMes[];
}

export interface ClientePorTipoDocumento {
    doc_type: string;
    count: number;
}

export interface ClientePorMes {
    year: number;
    month: number;
    count: number;
}

export interface ClientesStats {
    total: number;
    porTipoDocumento: ClientePorTipoDocumento[];
    porMes: ClientePorMes[];
}

export interface ItemPorTipo {
    kind: string;
    count: number;
}

export interface ItemsStats {
    total: number;
    productos: number;
    servicios: number;
    porTipo: ItemPorTipo[];
}

export interface LoggerStats {
    totalRegistros: number;
}

export interface CompanyStatisticsData {
    facturas: FacturasStats;
    nomina: NominaStats;
    clientes: ClientesStats;
    items: ItemsStats;
    logger: LoggerStats;
}

export interface CompanyStatisticsResponse {
    ok: boolean;
    data: CompanyStatisticsData;
}

/**
 * Obtiene las estadísticas de la compañía para el panel (facturas, nómina, clientes, ítems, actividad).
 */
export const getCompanyStatistics = async (): Promise<CompanyStatisticsResponse | null> => {
    try {
        const response = await fetch(API_ROUTES.COMPANY_STATISTICS, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message ?? "Error al cargar estadísticas");
        }

        return data;
    } catch (error) {
        throw error;
    }
};
