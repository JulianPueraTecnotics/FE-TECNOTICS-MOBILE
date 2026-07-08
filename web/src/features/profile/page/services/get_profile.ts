import { API_ROUTES } from "../../../../utils/global";

export type TiposDeDocumentos = "Nit" | "Cc" | "Ce" | "Pasaporte" | "Rc" | "Ti" | "Te" | "Psp" | "DiExtranjero" | "Pep" | "Nuip" | "NitExtranjero";

export const SmaIdNombre = {
    RC: "11",
    TI: "12",
    CC: "13",
    TE: "21",
    CE: "22",
    NIT: "31",
    PSP: "41",
    DI_EXTRANJERO: "42",
    PEP: "47",
    PASAPORTE: "48",
    NIT_EXTRANJERO: "50",
    NUIP: "91",
} as const;

export type SmaIdNombre = (typeof SmaIdNombre)[keyof typeof SmaIdNombre];

/** Rango de consecutivos DIAN para un prefijo (resolución). */
export type PrefixResolution = {
    init: number;
    end: number;
    /** Números que el sistema debe saltar al asignar el siguiente consecutivo. */
    locked?: number[];
    status?: "active" | "inactive";
    start_date?: string;
    end_date?: string;
    tipo_doc_electronico?: "01" | "02" | "03" | "11";
    /**
     * Tipo de factura (subtipo DIAN/Simba). Incluye notas: `92` (nota débito), `020` (NC sin referencia, 3 dígitos).
     * Legacy: `10` / `12` pueden venir de datos antiguos.
     */
    tipo_factura?: "01" | "02" | "03" | "04" | "05" | "20" | "92" | "020" | "10" | "12";
    /** Código o número de la resolución DIAN. */
    resolution?: string;
};

/** Prefijo de compañía: código, por defecto y resolución de numeración. */
export type CompanyPrefix = {
    prefix: string;
    default: boolean;
    /** true = prefijo de Nómina Electrónica (no de facturación). */
    is_nomina?: boolean;
    /** Puede faltar en datos legacy; el front normaliza al leer. */
    resolution?: PrefixResolution;
};

export type DocumentType = {
    public_id: string;
    url: string;
    original_name: string;
};

export type ReceiveBillsReportsPeriod = {
    daily: boolean;
    weekly: boolean;
    monthly: boolean;
};

export type ReceiveBillsReportsConfig = {
    enabled: boolean;
    /** Si está vacío, el backend usa company.email como destinatario. */
    emails: string[];
    period: ReceiveBillsReportsPeriod;
};

export interface CompanyInterface {
    _id: string;

    external_id?: string;
    newDomain?: string;

    razon_social: string;
    logo: DocumentType;
    doc_type: {
        value: TiposDeDocumentos;
        sma_id_nombre: string;
    };
    doc_number: string;
    doc_number_dv?: string;

    email: string;
    phone: string;
    website?: string;

    password?: string;
    OTP_recovery?: number;

    address: {
        value: string;
        ciudad_codigo: string;
        departamento_codigo: string;
        pais_codigo: string;
        zip_code?: string;
    };
    bank_account?: {
        name?: string;
        account_number?: string;
        account_type?: "ahorro" | "corriente";
    };

    legal_representative: {
        name: string;
        doc_type: TiposDeDocumentos;
        doc_number: string;
    };

    /** Prefijos con resolución DIAN (init, end, locked opcional). Solo uno con default: true. */
    prefixes: CompanyPrefix[];
    observations?: string;
    config?: {
        receive_bills_reports?: ReceiveBillsReportsConfig;
    };
    simba_token?: string;
    created?: Date;
    active: boolean;
}

export interface CompanyDocuments {
    _id: string;

    rut: DocumentType;
    camara_comercio: DocumentType;
    cedula_front: DocumentType;
    cedula_back: DocumentType;
    contrato_mandato: string;
    company_id: string;
}

export interface CompanyProfileResponse {
    company: CompanyInterface;
    // null cuando la empresa no tiene documentos de cuenta cargados (p. ej. demo).
    companyDocuments: CompanyDocuments | null;
}

export const getProfileService = async (): Promise<CompanyProfileResponse> => {
    const response = await fetch(API_ROUTES.GET_PROFILE, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || "Error al cargar el perfil");
    }

    return data as CompanyProfileResponse;
};
