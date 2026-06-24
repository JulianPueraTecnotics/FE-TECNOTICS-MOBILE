export type JournalType = "CC" | "CE" | "RC" | "FV" | "NC" | "AP" | "CL" | "DEP" | "NOM";
export type JournalStatus = "borrador" | "contabilizado" | "anulado";

export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
    CC: "Causación",
    CE: "Egreso",
    RC: "Ingreso / Recaudo",
    FV: "Factura de venta",
    NC: "Nota de contabilidad",
    AP: "Apertura",
    CL: "Cierre",
    DEP: "Depreciación",
    NOM: "Nómina",
};

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
    borrador: "Borrador",
    contabilizado: "Contabilizado",
    anulado: "Anulado",
};

export interface JournalLine {
    cuenta: string;
    cuenta_nombre?: string;
    tercero_id?: string | null;
    tercero_nombre?: string;
    centro_costo_id?: string | null;
    debito: number;
    credito: number;
    base?: number | null;
    descripcion?: string;
}

export interface JournalEntry {
    _id: string;
    tipo: JournalType;
    consecutivo: number;
    fecha: string;
    periodo: string;
    descripcion: string;
    estado: JournalStatus;
    origen: { tipo: string | null; id: string | null };
    total_debito: number;
    total_credito: number;
    marco: "NIIF" | "COLGAAP";
    lineas?: JournalLine[];
    reversa_de?: string | null;
}

export interface EntriesResponse {
    ok: boolean;
    entries: JournalEntry[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface JournalBookResponse {
    ok: boolean;
    entries: JournalEntry[];
    totalDebito: number;
    totalCredito: number;
}

export interface AccountingPeriod {
    _id: string;
    periodo: string;
    estado: "abierto" | "cerrado" | "bloqueado";
}

export interface ManualLineInput {
    cuenta: string;
    tercero_id?: string | null;
    centro_costo_id?: string | null;
    debito?: number;
    credito?: number;
    descripcion?: string;
}

export interface ManualEntryInput {
    tipo?: JournalType;
    fecha: string;
    descripcion: string;
    marco?: "NIIF" | "COLGAAP";
    lineas: ManualLineInput[];
}
