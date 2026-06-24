// Registration types
export interface SignupStep1Request {
    razon_social: string;
    doc_type: "Nit" | "Cc" | "Ce" | "Pasaporte";
    doc_number: string;
    doc_number_dv?: string;
    email: string;
    password: string;
    phone: string;
    website?: string;
    address: string;
    ciudad_codigo: string;
    departamento_codigo: string;
    pais_codigo: string;
    zip_code?: string;
    legal_representative: {
        name: string;
        doc_type: "Cc" | "Ce" | "Pasaporte" | "Ti";
        doc_number: string;
    };
}

export interface SignupStep1Response {
    success: boolean;
    message: string;
    data: {
        company_id: string;
        email: string;
        razon_social: string;
    };
}

export interface SignupStep2Request {
    companyId: string;
    OTP_recovery: number;
}

export interface SignupStep2Response {
    success: boolean;
    message: string;
    data: {
        contrato_mandato: {
            public_id: string;
            url: string;
            original_name: string;
        };
    };
}

export interface SignupStep3Response {
    success: boolean;
    message: string;
}

export interface SignupStep4Request {
    companyId: string;
}

export interface SignupStep4Response {
    success: boolean;
    message: string;
}

export interface UploadSignedMandatoResponse {
    success: boolean;
    message: string;
    data?: { company_id: string };
}

/** Respuesta de GET /company/signup/contrato-mandato/:companyId */
export interface ContratoMandatoUrlResponse {
    company_id: string;
    company_name: string;
    representante_name: string;
    contrato_mandato_url: string;
}

export interface ErrorResponse {
    error: string;
}

// DIAN Response Types
export interface DIANMessage {
    Nro: string;
    Tipo: string;
    Value: string;
}

export interface DIANNovedad {
    TipoLogCodigo: string;
    TipoLogTexto: string;
    IndicaFallo: boolean;
    IndicaFalloSpecified: boolean;
    NivelImportancia: string;
    CantMensajes: string;
    Mensaje: DIANMessage[];
    Adicional: string;
}

export interface DIANIndicadorProceso {
    Nombre: string;
    Value: boolean;
}

export interface DIANEstadosGenerales {
    UltimoEstadoSys: string;
    UltimoProcesoSys: string;
    IndicadorProceso: DIANIndicadorProceso[];
}

export interface DIANEtapa {
    Orden: string;
    Codigo: string;
    Estado: string;
    FechaHora: string;
    Mensaje: string;
}

export interface DIANEncabezadoRespuesta {
    SolicitudAceptada: boolean;
    ExistenNovedades: boolean;
    ExistenInfracciones: boolean;
    ExistenNovedadesCriticas: boolean;
    ExistenExcepciones: boolean;
    TextoResumenCorto: string;
    TextoResumenNovsCrit: string;
    EstadosGenerales: DIANEstadosGenerales;
    Novedad: DIANNovedad[];
    Etapa: DIANEtapa[];
}

export interface DIANCompleteResponse {
    DatosDeControl: {
        FechaRespuesta: string;
        FechaRespuestaSpecified: boolean;
        CodigoRastreo: string;
        SistemaSolicitante: {
            Tipo: string;
            Nombre: string;
            Version: string;
        };
        SistemaRespuesta: {
            Tipo: string;
            Abrev: string;
            Nombre: string;
            Version: string;
            Proceso: string;
        };
    };
    TipoRespuesta: string;
    RespuestaUnitaria: {
        EncabezadoRespuesta: DIANEncabezadoRespuesta;
        DocElectronicoExtendido: {
            DocumentoValido: boolean;
            DatosBasicos: {
                NitEmisor: string;
                Prefijo: string;
                Numero: string;
                FechaYHoraEmision: string;
                FechaYHoraEmisionSpecified: boolean;
            };
            DatosAdicionales: {
                DatoEmisor: Array<{
                    Nombre: string;
                    Valor: string;
                }>;
            };
        };
    };
}

// ========== Factura / Document Types (alineados con backend) ==========

export const TipoAmbiente = { PRODUCCION: "1", PRUEBAS: "2" } as const;
export type TipoAmbiente = (typeof TipoAmbiente)[keyof typeof TipoAmbiente];

export const IdEtiquetaUbicacionCorreo = { TO: "1", COPY: "2", COPY_HIDDEN: "3" } as const;
export type IdEtiquetaUbicacionCorreo = (typeof IdEtiquetaUbicacionCorreo)[keyof typeof IdEtiquetaUbicacionCorreo];

export const TipoDocElectronico = {
    FACTURA: "01",
    NOTA_DEBITO: "02",
    NOTA_CREDITO: "03",
    DOCUMENTO_SOPORTE: "11",
} as const;
export type TipoDocElectronico = (typeof TipoDocElectronico)[keyof typeof TipoDocElectronico];

export const TipoDeFactura = {
    /** Factura estándar */
    STANDAR: "10",
    /** Factura de transporte */
    TRANSPORTE: "12",
    /** Factura POS */
    POS: "20",
} as const;
export type TipoDeFactura = (typeof TipoDeFactura)[keyof typeof TipoDeFactura];

export const CodigoMoneda = {
    USD: "USD",
    EUR: "EUR",
    COP: "COP",
    GBP: "GBP",
    CAD: "CAD",
    MXN: "MXN",
    ARS: "ARS",
} as const;
export type CodigoMoneda = (typeof CodigoMoneda)[keyof typeof CodigoMoneda];

export const MedioDePago = { CONTADO: "1", CREDITO: "2" } as const;
export type MedioDePago = (typeof MedioDePago)[keyof typeof MedioDePago];

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

export type TiposDeDocumentosFactura = "Nit" | "Cc" | "Ce" | "Pasaporte" | "Rc" | "Ti" | "Te" | "Psp" | "DiExtranjero" | "Pep" | "Nuip" | "NitExtranjero";

type IdTerceroValue = `${TiposDeDocumentosFactura} ${string}`;

export const HeaderIdPersonalizacion = {
    FACTURA_ESTANDAR: "10",
    FACTURA_TRANSPORTE: "12",
    NOTA_CREDITO: "20",
    NOTA_CREDITO_SIN_REFERENCIA: "22",
    NOTA_DEBITO: "30",
    NOTA_DEBITO_SIN_REFERENCIA: "32",
} as const;
export type HeaderIdPersonalizacion = (typeof HeaderIdPersonalizacion)[keyof typeof HeaderIdPersonalizacion];

export interface ContactoReceptor {
    CorreoElectronico: string;
    IdEtiquetaUbicacionCorreo: IdEtiquetaUbicacionCorreo;
    SoloEnvioCasoDeFalloSpecified: boolean;
}

export interface IndicadoresAdicionales {
    NombreIndicador: string;
    Activado: boolean;
}

export interface EntityInfo {
    Name: string;
    Value: string;
}

export interface EntityExtraInfo {
    IdAdicional: { Value: string }[];
    Tercero: {
        IndicaATravesDeSpecified: boolean;
        IndicaAtencionASpecified: boolean;
        CodigoClasificacionIndustria?: { Value: string };
        IdTercero: { SmaIdCodigo: string; SmaIdNombre: SmaIdNombre; Value: IdTerceroValue }[];
        NombreTercero: { Value: string }[];
        UbicacionFisica?: {
            Direccion: {
                Id?: { Value: string };
                Departamento?: { Value: string };
                Ciudad?: { Value: string };
                ZonaPostal?: { Value: string };
                SubdivisionPais?: { Value: string };
                SubdivisionPaisCodigo?: { Value: string };
                LineaDireccion?: { TextoLinea: { Value: string } }[];
                Pais?: {
                    Codigo?: { Value: string };
                    Nombre?: { IdLenguaje: string; Value: string };
                };
            };
        };
        EsquemaTributarioTercero?: {
            NombreRegistrado?: { Value: string };
            NumeroIdTributario?: { SmaIdCodigo: string; SmaIdNombre: SmaIdNombre; Value: IdTerceroValue };
            NivelTributario?: { ListaNombre: string; Value: string };
            DireccionParaImpuestos?: unknown;
            EsquemaTributario?: { Id?: { Value: string }; Nombre?: { IdLenguaje: string; Value?: string } };
        }[];
        EntidadLegalTercero?: unknown[];
    };
}

export interface ContenidoExtension {
    FabricanteSoftware?: { InformacionDelFabricanteDelSoftware: EntityInfo[] };
    BeneficiosComprador?: { InformacionBeneficiosComprador: EntityInfo[] };
    PuntoVenta?: { InformacionCajaVenta: EntityInfo[] };
    CustomTagGeneral?: {
        TotalesCop?: {
            FctConvCop?: string;
            MonedaCop?: string;
            SubTotalCop?: string;
            [key: string]: string | undefined;
        };
    };
}

export interface ParametrosHeader {
    VersionDocElectronico: string;
    NombreSistemaEmisor: string;
    VersionSistemaEmisor: string;
    ModoRespuesta: string;
    TipoAmbiente: TipoAmbiente;
    TokenEmpresa: string;
    PasswordEmpresa: string;
    TipoReporte: string;
    Personalizacion: string;
    ContactoReceptor: ContactoReceptor[];
    IndicadoresAdicionales: IndicadoresAdicionales[];
}

export interface ExtensionesHeader {
    ContenidoExtension: ContenidoExtension;
}

export interface EncabezadoHeader {
    TipoDocElectronico: TipoDocElectronico | string;
    IdPersonalizacion?: { Value: HeaderIdPersonalizacion | string };
    PrefijoDocumento: string;
    NumeroDocumento: string;
    IndicaCopiaSpecified: boolean;
    FechaYHoraDocumento?: Date | string;
    FechaYHoraEmision?: string;
    FechaDeVencimientoSpecified: boolean;
    TipoDeFactura?: { Value: TipoDeFactura | string };
    FechaTributariaSpecified: boolean;
    CodigoMoneda: { Value: CodigoMoneda };
    CantidadLineas: number;
    CantidadLineasSpecified: boolean;
    CentroDeCostoCodigo?: { Value: string };
    CentroDeCostoNombre?: { Value: string };
}

export interface RespuestaMotivoNotaItems {
    IdReferencia: { Value: string };
    CodRespuesta: { Value: string };
    Descripcion: { Value: string };
    FechaEfectivaSpecified: boolean;
    HoraEfectivaSpecified: boolean;
}

export interface EncabezadoHeader_NOTAS_DB_DC extends EncabezadoHeader {
    RespuestaMotivoNota?: RespuestaMotivoNotaItems[];
}

export interface TercerosHeader {
    TerceroProveedorContable: EntityExtraInfo;
    TerceroClienteContable: EntityExtraInfo;
}

export interface SubTotalImpuesto {
    BaseImponible: { IdMoneda: CodigoMoneda; Value: number };
    ValorImpuesto: { IdMoneda: CodigoMoneda; Value: number };
    SecuenciaNumericaSpecified: boolean;
    PorcentajeSpecified: boolean;
    PorcentajeRangoSpecified: boolean;
    CategoriaImpuesto: {
        Porcentaje: number;
        PorcentajeSpecified: boolean;
        PorcentajeRangoSpecified: boolean;
        EsquemaTributario: { Id: { Value: string }; Nombre?: { Value: string } };
    };
}

export interface LineImpuesto {
    ValorImpuesto: { IdMoneda: CodigoMoneda; Value: number };
    ValorAjusteRedondeo: { IdMoneda: CodigoMoneda; Value: string };
    IndicaEsSoloEvidencia: boolean;
    IndicaEsSoloEvidenciaSpecified: boolean;
    IndicaImpuestoIncluidoSpecified: boolean;
    SubTotalImpuesto: SubTotalImpuesto[];
}

export interface LineasHeader {
    Id: { Value: string };
    Nota?: { Value: string }[];
    Cantidad: { CodUnidad: string; Value: number };
    ValorNeto: { IdMoneda: CodigoMoneda; Value: number };
    FechaVigenciaImpuestoSpecified: boolean;
    IndicaEsGratisSpecified: boolean;
    /** Impuestos de la línea (backend puede enviar TotalImpusto por typo) */
    TotalImpuesto?: LineImpuesto[];
    TotalImpusto?: LineImpuesto[];
    Item: {
        Descripcion?: { Value: string }[];
        ItemsPorEmpaqueSpecified?: boolean;
        IndicaDesdeCatalogoSpecified?: boolean;
        Nombre: { Value: string };
        IndicadorDePeligroSpecified?: boolean;
        IdItemEstandar?: { Id: { SmaIdCodigo: string; SmaIdNombre: string; Value: string } };
        PropiedadesAdicionalesItem?: { Nombre: { Value: string }; Valor: { Value: string } }[];
        Precio: {
            ValorPrecio: { IdMoneda: CodigoMoneda; Value: number };
            CantidadBase: { CodUnidad: string; Value: number };
            FactorConvAUnidadPedidoSpecified?: boolean;
        };
    };
}

export interface AgregadoComercial {
    MediosDePago: {
        Id?: { Value: string };
        CodigoMedioDePago: { Value: MedioDePago };
        FechaLimitePago?: string;
        FechaLimitePagoSpecified?: boolean;
        NotaInstruccion?: { Value: string }[];
        IdPago?: { Value: string }[];
    }[];
}

export type TipoRetencion = "ReteIVA" | "ReteRenta" | "ReteICA";

export interface ReteIVAInput {
    base_imponible: number;
    valor_impuesto: number;
    porcentaje?: number;
}

export interface RetencionInput {
    tipo: "ReteRenta" | "ReteICA";
    base_imponible: number;
    valor_impuesto: number;
    porcentaje: number;
}

export const RETENCION_ESQUEMA: Record<TipoRetencion, { Id: string; Nombre: string }> = {
    ReteIVA: { Id: "05", Nombre: "ReteIVA" },
    ReteRenta: { Id: "06", Nombre: "ReteRenta" },
    ReteICA: { Id: "07", Nombre: "ReteICA" },
};

export interface TotalesHeader {
    TotalMonetario: {
        ValorBruto: { IdMoneda: CodigoMoneda; Value: number };
        ValorBaseImpuestos: { IdMoneda: CodigoMoneda; Value: number };
        TotalMasImpuestos: { IdMoneda: CodigoMoneda; Value: number };
        ValorAPagar: { IdMoneda: CodigoMoneda; Value: number };
        ValorAjusteRedondeo?: { IdMoneda: CodigoMoneda; Value: string | number };
        ValorAPagarAlternativo?: { IdMoneda: CodigoMoneda; Value: string | number };
    };
    TotalRetenciones?: Array<{
        ValorImpuesto: { IdMoneda: CodigoMoneda; Value: number | string };
        ValorAjusteRedondeo: { IdMoneda: CodigoMoneda; Value: string };
        IndicaEsSoloEvidencia?: boolean;
        IndicaEsSoloEvidenciaSpecified?: boolean;
        IndicaImpuestoIncluidoSpecified: boolean;
        SubTotalImpuesto: SubTotalImpuesto[];
    }>;
    /** Algunas respuestas incluyen impuestos desglosados a nivel documento */
    TotalImpuestos?: Array<{
        ValorImpuesto?: { IdMoneda: CodigoMoneda; Value: number };
        SubTotalImpuesto?: SubTotalImpuesto[];
        [key: string]: unknown;
    }>;
}

export type TotalesHeaderInput = TotalesHeader & {
    reteiva?: ReteIVAInput;
    retenciones?: RetencionInput[];
};

export interface ReferenciaItems {
    ReferenciaDocFactura: {
        Id: { Value: string };
        EsCopiaSpecified: boolean;
        UID: { Value: string };
        Fecha: { Value: Date };
        FechaSpecified: boolean;
        HoraSpecified: boolean;
    };
}

export interface FacturaSystemInfo {
    idExternUser?: string;
    requestFrom?: string;
    facturaStatus: "PENDING" | "APPROVED" | "REJECTED" | "SENT";
    /** Marca de borrador: la factura existe pero aún no se ha emitido/validado en la DIAN. */
    is_draft?: boolean;
    dianDocKey: string;
    dianDocFilename: string;
    dianStatusDescr: string;
    dianCompleteResponse?: DIANCompleteResponse | object;
    company_id: string;
}

/** Factura (documento electrónico) – estructura alineada con backend */
export interface Factura {
    _id: string;
    Parametros?: ParametrosHeader;
    Extensiones?: ExtensionesHeader;
    Encabezado: EncabezadoHeader | EncabezadoHeader_NOTAS_DB_DC;
    Referencias?: { ReferenciaFacturacion: ReferenciaItems[] };
    Terceros: TercerosHeader;
    Lineas: LineasHeader[];
    AgregadoComercial: AgregadoComercial;
    Notas: { Value: string }[];
    Totales: TotalesHeader;
    systemInfo: FacturaSystemInfo;
}

export interface IitemaData {
    id: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    description: string;
    iva: number;
}

export interface TransporteData {
    fct_conv_cop?: string;
    moneda_cop?: string;
    rete_fue_cop?: string;
    rete_iva_cop?: string;
    rete_ica_cop?: string;
    tot_anticipos_cop?: string;
}

/** Request para crear factura (payload API) */
export interface CrearFacturaRequest {
    token?: string;
    facturaData: IFacturaBody["facturaData"];
}

/** Respuesta paginada de listado de facturas */
export interface FacturasResponse {
    facturas: Factura[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface IFacturaBody {
    token: string;
    facturaData: {
        items: IitemaData[];
        totals: TotalesHeader;
        medioDePago: MedioDePago;
        tipoFactura: TipoDeFactura;
        TipoDocElectronico: TipoDocElectronico;
        SmaIdNombre: SmaIdNombre;
        ValorLetras: string;
        CodigoMoneda: CodigoMoneda;
        prefijoDocumento: string;
        observaciones: string;
        fechaVencimiento: string;
        docKey?: string;
        isPOS?: boolean;
    };
}

// Client Types — address can be string or object from API
export interface ClientAddressObject {
    value?: string;
    ciudad_codigo?: string;
    departamento_codigo?: string;
    pais_codigo?: string;
    zip_code?: string;
}

/** Request body for creating a client; address is sent as object with codes from paises/departamentos/municipios */
export interface CreateClientRequest {
    name: string;
    email: string;
    phone: string;
    doc_type: string;
    doc_number: string;
    tipoPersona: "1" | "2";
    address: {
        value: string;
        ciudad_codigo: string;
        departamento_codigo: string;
        pais_codigo: string;
        zip_code?: string;
    };
    /** Nombre del usuario que ejecuta la acción (para el log de auditoría) */
    executed_by?: string;
}

/** Request body for updating a client (partial) */
export interface UpdateClientRequest {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
        value: string;
        ciudad_codigo: string;
        departamento_codigo: string;
        pais_codigo: string;
        zip_code?: string;
    };
}

export interface ClientsResponse {
    clients: IExternUser[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ============================================
// Subusuarios (`/sub-users`)
// ============================================
export type SubUserDocType = "Nit" | "Cc" | "Ce" | "Pasaporte" | "Rc" | "Ti" | "Te" | "Psp" | "DiExtranjero" | "Pep" | "Nuip" | "NitExtranjero";

export interface SubUserAvatar {
    public_id?: string;
    url?: string;
    original_name?: string;
}

export interface ISubUser {
    _id: string;
    company_id: string;
    name: string;
    last_name: string;
    email: string;
    phone: string;
    doc_type: string;
    doc_number: string;
    role?: string;
    avatar?: SubUserAvatar | null;
    active?: boolean;
    created_at?: string;
}

export interface SubUsersResponse {
    ok?: boolean;
    users: ISubUser[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateSubUserRequest {
    name: string;
    last_name: string;
    email: string;
    phone: string;
    doc_type: string;
    doc_number: string;
}

export interface UpdateSubUserRequest {
    name?: string;
    last_name?: string;
    phone?: string;
    doc_type?: string;
    doc_number?: string;
}

export interface CreateClientResponse {
    success?: boolean;
    client?: IExternUser;
    message?: string;
}

export interface DeleteResponse {
    ok?: boolean;
    success?: boolean;
    message?: string;
}

export type TiposDeDocumentos = "Cc" | "Ce" | "Ti" | "Pasaporte" | "Nit" | "Nuip";
export type TipoPersona = "1" | "2";

export interface IExternUser {
    _id: string;
    name: string;
    doc_type: string;
    doc_number: string;
    doc_number_dv?: string;
    email: string;
    phone: string;
    address?: string | ClientAddressObject;
    tipoPersona: string;
}

// Item Types
/** Item (producto/servicio) – estructura alineada con backend. En respuestas API incluye _id. */
export interface ItemData {
    _id?: string;
    code?: string;
    company_id?: string;
    external_id?: string;
    name: string;
    price: number;
    /** Costo estándar unitario (para el costo de ventas). */
    cost_price?: number;
    quantity: number;
    total: number;
    description: string;
    kind: "product" | "service";
    reference_id?: string;
    taxes: {
        iva: number;
        other: number;
    };
    /** Código de unidad de medida (ej: KGM, LTR, PCE) */
    unidad_medida?: string;
    /** Opcional: ReteIVA aplicada a esta línea (sobre el IVA del ítem) */
    reteiva?: ReteIVAInput;
    /** Opcional: Retenciones por línea (ReteRenta, ReteICA) */
    retenciones?: RetencionInput[];
}

/** ReteIVA para ítems (misma forma que ReteIVAInput) */
export interface ReteIVA {
    base_imponible: number;
    valor_impuesto: number;
    porcentaje?: number;
}

/** Retención por ítem (ReteRenta, ReteICA) */
export interface Retencion {
    tipo: "ReteRenta" | "ReteICA";
    base_imponible: number;
    valor_impuesto: number;
    porcentaje: number;
}

/** Payload para crear ítem (backend recibe name, price, quantity, description, kind, code, taxes, unidad_medida) */
export interface CreateItemRequest {
    code?: string;
    name: string;
    price: number;
    /** Costo estándar unitario del producto (para el costo de ventas). */
    cost_price?: number;
    quantity: number;
    description: string;
    kind: "product" | "service";
    taxes: { iva: number; other: number };
    unidad_medida?: string;
    total?: number;
    reteiva?: ReteIVAInput;
    retenciones?: RetencionInput[];
    /** Nombre del usuario que ejecuta la acción (para el log de auditoría) */
    executed_by?: string;
}

/** Payload para actualizar ítem (campos editables) */
export type UpdateItemRequest = Partial<CreateItemRequest>;

export interface ItemsResponse {
    ok: boolean;
    items: ItemData[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateItemResponse {
    ok?: boolean;
    item?: ItemData;
    message?: string;
}

export interface DeleteMultipleResponse {
    ok?: boolean;
    deletedCount?: number;
    message?: string;
}

// ============================================
// COTIZACIONES (documento de venta no fiscal)
// Origen de referencia: fichas_tecnicas (modelo Cotizacion).
// Adaptado a las convenciones de este portal (ItemData / IExternUser).
// ============================================

/** Estado del documento. Una cotización aceptada puede convertirse a factura. */
export const QuoteStatus = {
    DRAFT: "draft",
    SENT: "sent",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    EXPIRED: "expired",
    INVOICED: "invoiced",
} as const;
export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
    draft: "Borrador",
    sent: "Enviada",
    accepted: "Aceptada",
    rejected: "Rechazada",
    expired: "Vencida",
    invoiced: "Facturada",
};

/** Forma de pago de la cotización (informativo, no fiscal). */
export type QuotePaymentForm = "Contado" | "Crédito";

/**
 * Línea de cotización. Equivale a una línea de factura: ítem con precio e IVA.
 * `descuento` admite porcentaje ("10%") o valor fijo ("5000"), como en el origen.
 */
export interface QuoteLine {
    /** _id del ItemData del catálogo (vacío si se captura manual) */
    item_id?: string;
    code?: string;
    name: string;
    description?: string;
    quantity: number;
    /** Precio unitario */
    price: number;
    /** IVA en PORCENTAJE entero (0, 5, 19) — coherente con CreateItemRequest.taxes.iva */
    iva: number;
    /** Descuento de la línea: "10%" (porcentaje) o "5000" (valor fijo). Por defecto "0". */
    descuento?: string;
    unidad_medida?: string;
}

/** Totales calculados de la cotización. `retenciones` se guarda como PORCENTAJE. */
export interface QuoteTotals {
    /** Suma de (precio * cantidad) de todas las líneas */
    bruto: number;
    /** Suma de descuentos por línea */
    descuento: number;
    /** bruto - descuento */
    subtotal: number;
    /** Monto del IVA */
    iva: number;
    /** Porcentaje de retención aplicado al documento (no monto) */
    retenciones: number;
    /** subtotal + iva - (retenciones% * (subtotal + iva)) */
    total: number;
    /** Total en letras (M/CTE) */
    valor_letras?: string;
}

/** Cotización (documento). Alineado con el modelo Quote del backend. */
export interface IQuote {
    _id: string;
    /** Consecutivo legible (ej. "COT-0001") */
    number: string;
    consecutivo?: number;
    /** Slug del link público /cot/public/:slug */
    slug?: string;
    client_id: string;
    client_name?: string;
    client_doc?: string;
    client_email?: string;
    client_phone?: string;
    client_address?: string;
    /** Correos adicionales (CC) */
    extra_emails?: string[];
    lines: QuoteLine[];
    totals: QuoteTotals;
    payment_form?: QuotePaymentForm;
    payment_method?: string;
    notes?: string;
    status: QuoteStatus;
    /** Aprobación pública con código */
    approved?: boolean;
    approved_at?: string;
    /** QR del link público */
    qr?: { public_id?: string; url?: string };
    /** Fecha de creación (timestamps de Mongo) */
    createdAt?: string;
    created_at?: string;
    valid_until?: string;
    /** Si ya se convirtió, _id de la factura generada */
    invoice_id?: string;
}

/** Payload para crear cotización. Los totales los puede recalcular el backend. */
export interface CreateQuoteRequest {
    client_id: string;
    lines: QuoteLine[];
    payment_form?: QuotePaymentForm;
    payment_method?: string;
    /** Porcentaje de retención del documento */
    retenciones?: number;
    notes?: string;
    /** Correo principal de envío (editable; puede diferir del correo del cliente) */
    client_email?: string;
    /** Correos adicionales (CC) */
    extra_emails?: string[];
    /** Fecha de vencimiento (YYYY-MM-DD) */
    valid_until?: string;
    /** Si true, al crear se envía la cotización por correo al cliente */
    send_email?: boolean;
    /** Nombre del usuario que ejecuta la acción (para el log de auditoría) */
    executed_by?: string;
}

/** Cotización pública (sin security_code), para la vista /cot/public/:slug */
export interface PublicQuoteResponse {
    ok?: boolean;
    quote?: IQuote;
    message?: string;
}

export type UpdateQuoteRequest = Partial<CreateQuoteRequest>;

export interface QuotesResponse {
    ok?: boolean;
    quotes: IQuote[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
    /** Suma global de totales (para el indicador del listado) */
    total_amount?: number;
}

export interface CreateQuoteResponse {
    ok?: boolean;
    quote?: IQuote;
    message?: string;
}

/** Respuesta de convertir cotización → factura */
export interface ConvertQuoteResponse {
    ok?: boolean;
    /** _id de la factura/borrador creada */
    invoice_id?: string;
    factura?: Factura;
    message?: string;
}

// ============================================
// RECAUDOS / CARTERA (cuentas por cobrar)
// ============================================

/** Medio por el que se recibe el pago de una factura. */
export const PaymentMethod = {
    EFECTIVO: "efectivo",
    TRANSFERENCIA: "transferencia",
    CONSIGNACION: "consignacion",
    TARJETA: "tarjeta",
    CHEQUE: "cheque",
    OTRO: "otro",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    consignacion: "Consignación",
    tarjeta: "Tarjeta",
    cheque: "Cheque",
    otro: "Otro",
};

/** Estado de cobro de una factura (derivado del saldo). */
export const ReceivableStatus = {
    PENDING: "pendiente",
    PARTIAL: "parcial",
    PAID: "pagada",
    OVERDUE: "vencida",
} as const;
export type ReceivableStatus = (typeof ReceivableStatus)[keyof typeof ReceivableStatus];

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
    pendiente: "Pendiente",
    parcial: "Abonada",
    pagada: "Pagada",
    vencida: "Vencida",
};

/** Pago/abono registrado contra una factura. */
export interface InvoicePayment {
    _id: string;
    invoice_id: string;
    /** Efectivo recibido (ya descontada la retención). */
    amount: number;
    /** Retención aplicada por el cliente. */
    retencion?: number;
    /** Base sobre la que se calculó la retención (subtotal antes de impuestos). */
    retencion_base?: number;
    /** % efectivo de retención sobre la base. */
    retencion_pct?: number;
    /** Total aplicado al saldo = amount + retencion. */
    applied?: number;
    method: PaymentMethod;
    /** Fecha del pago (ISO) */
    paid_at: string;
    reference?: string;
    notes?: string;
    /** Id del comprobante de ingreso generado por este pago, si aplica */
    receipt_id?: string;
    created_by?: string;
}

/** Detalle de una factura cubierta por el comprobante (pago múltiple). */
export interface ReceiptItem {
    invoice_id: string;
    invoice_number: string;
    balance_before?: number;
    amount: number;
    retencion?: number;
}

/** Comprobante de ingreso (recibo de caja) asociado a uno o varios pagos. */
export interface ReceiptVoucher {
    _id: string;
    invoice_id: string;
    /** Consecutivo legible (ej. "RC-0001") */
    number: string;
    /** Efectivo recibido. */
    amount: number;
    /** Retención total aplicada. */
    retencion?: number;
    /** Total aplicado = amount + retencion. */
    applied?: number;
    method: PaymentMethod;
    issued_at: string;
    invoice_number?: string;
    /** Facturas cubiertas (pago múltiple). */
    items?: ReceiptItem[];
    /** ¿Ya se envió por correo al cliente? */
    emailed?: boolean;
    payment_id?: string;
}

/**
 * Factura vista desde Cartera: datos mínimos + totales de cobro.
 * El backend la deriva de la factura electrónica añadiendo `paid`/`balance`.
 */
export interface ReceivableInvoice {
    _id: string;
    /** Prefijo + número (ej. "FE-1024") */
    number: string;
    client_name?: string;
    client_email?: string;
    client_doc?: string;
    /** Total de la factura */
    total: number;
    /** Base imponible (subtotal antes de impuestos), para calcular % de retención */
    base?: number;
    /** Total de notas crédito aplicadas (reduce el saldo por cobrar) */
    nota_credito?: number;
    /** Suma de pagos registrados */
    paid: number;
    /** total - paid */
    balance: number;
    status: ReceivableStatus;
    issued_at?: string;
    due_date?: string;
    /** Número de comprobantes de ingreso ya generados */
    receipts_count?: number;
}

export interface ReceivablesResponse {
    ok?: boolean;
    invoices: ReceivableInvoice[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ReceivablesSummary {
    total_por_cobrar: number;
    total_vencido: number;
    cantidad_facturas: number;
}

/** Payload para registrar un pago/abono. */
export interface CreatePaymentRequest {
    /** Efectivo recibido. */
    amount: number;
    /** Retención aplicada por el cliente (opcional; si se omite, el back la deriva del saldo). */
    retencion?: number;
    method: PaymentMethod;
    paid_at: string;
    reference?: string;
    notes?: string;
    /** Si true, el backend genera el comprobante y lo envía al correo del cliente. */
    send_receipt?: boolean;
    executed_by?: string;
}

/** Línea de un pago que cubre varias facturas. */
export interface BatchPaymentItem {
    invoice_id: string;
    amount: number;
    retencion?: number;
}

/** Payload para registrar un pago de varias facturas (un comprobante). */
export interface CreateBatchPaymentRequest {
    items: BatchPaymentItem[];
    method: PaymentMethod;
    paid_at: string;
    reference?: string;
    notes?: string;
    send_receipt?: boolean;
    executed_by?: string;
}

export interface CreateBatchPaymentResponse {
    ok?: boolean;
    receipt?: ReceiptVoucher;
    count?: number;
    total_amount?: number;
    total_retencion?: number;
    message?: string;
}

export interface CreatePaymentResponse {
    ok?: boolean;
    payment?: InvoicePayment;
    receipt?: ReceiptVoucher;
    /** Estado/saldo actualizado de la factura */
    invoice?: ReceivableInvoice;
    message?: string;
}

export interface PaymentsResponse {
    ok?: boolean;
    payments: InvoicePayment[];
}

export interface ReceiptsResponse {
    ok?: boolean;
    receipts: ReceiptVoucher[];
}

// ============================================
// PLANTILLAS / FACTURAS RECURRENTES
// ============================================

export const RecurrenceType = {
    NONE: "none",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    BIMONTHLY: "bimonthly",
    QUARTERLY: "quarterly",
    YEARLY: "yearly",
} as const;
export type RecurrenceType = (typeof RecurrenceType)[keyof typeof RecurrenceType];

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
    none: "Sin recurrencia",
    weekly: "Semanal",
    monthly: "Mensual",
    bimonthly: "Bimestral",
    quarterly: "Trimestral",
    yearly: "Anual",
};

/** Plantilla de factura (datos mínimos para el listado). */
export interface InvoiceTemplate {
    _id: string;
    number: string;
    client_name?: string;
    client_doc?: string;
    total: number;
    recurrence: RecurrenceType;
    last_invoiced_at?: string;
    /** Próxima fecha de facturación (recurrentes) */
    next_due?: string;
    /** ¿Está vencida la próxima facturación? */
    pending: boolean;
}

export interface TemplatesResponse {
    ok?: boolean;
    templates: InvoiceTemplate[];
    /** Nº de recurrentes pendientes por facturar */
    pending_count: number;
}

export interface SetTemplateRequest {
    is_template: boolean;
    recurrence?: RecurrenceType;
}

// ============================================
// REMISIONES (entrega firmada por el cliente)
// ============================================

export const RemisionStatus = {
    PENDING: "pending",
    SIGNED: "signed",
    REJECTED: "rejected",
} as const;
export type RemisionStatus = (typeof RemisionStatus)[keyof typeof RemisionStatus];

export const REMISION_STATUS_LABELS: Record<RemisionStatus, string> = {
    pending: "Pendiente de firma",
    signed: "Firmada",
    rejected: "Rechazada",
};

export interface RemisionLine {
    code?: string;
    name: string;
    description?: string;
    quantity: number;
    price: number;
    iva: number;
}

export interface IRemision {
    _id: string;
    number: string;
    slug?: string;
    source: "invoice" | "quote" | "manual";
    source_id?: string;
    source_number?: string;
    client_id?: string;
    client_name: string;
    client_doc?: string;
    client_email?: string;
    client_phone?: string;
    client_address?: string;
    lines: RemisionLine[];
    total: number;
    notes?: string;
    /** Firma del cliente (PNG dataURL); presente solo en vista privada/pública firmada */
    signature_data_url?: string;
    signed_by?: string;
    signed_at?: string;
    status: RemisionStatus;
    qr?: { public_id?: string; url?: string };
    createdAt?: string;
}

export interface RemisionesResponse {
    ok?: boolean;
    remisiones: IRemision[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateRemisionRequest {
    source: "invoice" | "quote";
    source_id: string;
    notes?: string;
    send_email?: boolean;
}

export interface CreateRemisionResponse {
    ok?: boolean;
    remision?: IRemision;
    /** Link público de firma (para copiar/compartir). */
    sign_url?: string;
    message?: string;
}

export interface SuscriptionPlan {
    _id: string;
    title: string;
    description: string;
    price: number;
    features: string[];
    include_documents: number;
    price_per_document: number;

    type: "trial2days" | "1year";
    created: Date;
    updated: Date;

    is_public?: boolean;
    personalized_company?: string;
}

export interface Suscription {
    _id: string;
    company_id: string;
    plan_id: string;

    start_date: Date;
    end_date: Date;

    base_documents: number;
    extra_documents: number;
    total_documents: number;

    used_documents: number;

    total_price: number;

    status: "active" | "inactive" | "expired";

    last_payment_date: Date;
    last_transaction_id: string;

    created: Date;
    updated: Date;
}
