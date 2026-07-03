export interface AccountPair {
    niif?: string;
    colgaap?: string;
}

export interface AccountingConfig {
    _id?: string;
    company_id?: string;
    marco: "niif" | "colgaap" | "ambos";
    cuenta_por_pagar?: AccountPair;
    cuenta_gasto_costo?: AccountPair;
    cuenta_iva?: AccountPair;
    cuenta_ingreso?: AccountPair;
    cuenta_iva_generado?: AccountPair;
    cuenta_cliente?: AccountPair;
    cuenta_inventario?: AccountPair;
    cuenta_costo_ventas?: AccountPair;
    cuenta_retencion_sufrida?: AccountPair;
    cuenta_gasto_nomina?: AccountPair;
    cuenta_salarios_por_pagar?: AccountPair;
    cuenta_aportes_por_pagar?: AccountPair;
    cuenta_retencion_nomina_por_pagar?: AccountPair;
    cuenta_retefuente?: AccountPair;
    cuenta_reteiva?: AccountPair;
    cuenta_reteica?: AccountPair;
    cuenta_anticipos?: AccountPair;
    cuenta_caja_menor?: AccountPair;
    cuenta_banco?: AccountPair;
    cuenta_resultado_ejercicio?: AccountPair;
}

export interface BlockedRange {
    from: number;
    to: number;
    motivo?: string;
}

export interface AccountingSequence {
    _id?: string;
    type: "egreso" | "causacion";
    base_number: number;
    current_number: number;
    numero_comprobante?: number;
    status: "configured" | "in_use";
    blocked_ranges: BlockedRange[];
}

export interface CostCenter {
    _id: string;
    codigo: string;
    descripcion: string;
    active: boolean;
}

export interface CoaAccount {
    _id: string;
    codigo: string;
    nombre: string;
    tipo?: "MAYOR" | "AUXILIAR";
    naturaleza?: "DEBITO" | "CREDITO";
    nivel?: number;
    codigo_padre?: string | null;
    estado: "ACTIVA" | "INACTIVA";
    es_movimiento?: boolean;
    // Clasificación funcional de la plantilla contable.
    categoria?: string | null;
    clase?: string | null;
    relacion_con?: string | null;
    maneja_vencimientos?: "no" | "cartera" | "proveedores" | null;
    diferencia_fiscal?: boolean;
}

/** Fila de la plantilla contable "Cuentas contables" (todas las columnas). */
export interface CoaTemplateRow {
    codigo: string;
    nombre: string;
    categoria?: string;
    clase?: string;
    relacion_con?: string;
    maneja_vencimientos?: string;
    diferencia_fiscal?: string;
    activo?: string;
    nivel_agrupacion?: string;
}

export interface Role {
    _id: string;
    name: string;
    permissions: string[];
}

export interface PermissionGroup {
    module: string;
    permissions: { code: string; label: string }[];
}

export interface Uvt {
    _id?: string;
    anio: number;
    valor: number;
}

export type RetentionType = "fuente" | "iva" | "ica" | "autorrenta";

export interface RetentionConcept {
    _id: string;
    tipo: RetentionType;
    codigo: string;
    descripcion: string;
    base_minima_uvt: number;
    tarifa: number;
    cuenta?: string;
    codigo_municipio?: string | null;
    active: boolean;
}
