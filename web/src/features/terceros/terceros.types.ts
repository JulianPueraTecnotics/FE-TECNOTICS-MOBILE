export type TerceroRole = "cliente" | "proveedor" | "empleado" | "otro";

export const ROLE_LABELS: Record<TerceroRole, string> = {
    cliente: "Cliente",
    proveedor: "Proveedor",
    empleado: "Empleado",
    otro: "Otro",
};

export interface TerceroAddress {
    value?: string;
    ciudad?: string;
    codigo_municipio?: string;
    departamento?: string;
    pais?: string;
}

export interface TerceroBank {
    banco?: string;
    tipo_cuenta?: string;
    numero_cuenta?: string;
    codigo_ach_banco?: string;
}

export interface Tercero {
    _id: string;
    company_id: string;
    name: string;
    doc_type?: string;
    doc_number: string;
    doc_number_dv?: string;
    tipo_persona?: "1" | "2";
    sma_id_nombre?: string;
    email?: string;
    phone?: string;
    address?: TerceroAddress;
    roles: TerceroRole[];
    responsabilidades_fiscales?: string[];
    responsable_iva?: boolean;
    gran_contribuyente?: boolean;
    autorretenedor?: boolean;
    regimen_simple?: boolean;
    codigo_ciiu?: string;
    bank?: TerceroBank;
    source?: "manual" | "import" | "migrado";
    conflicto_revision?: boolean;
    active?: boolean;
}

export interface TercerosResponse {
    ok: boolean;
    terceros: Tercero[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface MigrateResult {
    ok: boolean;
    creados: number;
    fusionados: number;
    conflictos: number;
    omitidos: number;
    total: number;
    message: string;
}
