// Catálogos DIAN de Nómina Electrónica (homologación SIMBA). Espejan los enums del backend.

export interface CatalogOption {
    value: string;
    label: string;
}

/** Tipos de documento DIAN (código numérico que espera el back en Trabajador.TipoDocumento). */
export const TIPO_DOCUMENTO_OPTIONS: CatalogOption[] = [
    { value: "13", label: "Cédula de ciudadanía" },
    { value: "12", label: "Tarjeta de identidad" },
    { value: "11", label: "Registro civil" },
    { value: "22", label: "Cédula de extranjería" },
    { value: "21", label: "Tarjeta de extranjería" },
    { value: "41", label: "Pasaporte" },
    { value: "42", label: "Documento de identificación extranjero" },
    { value: "47", label: "PEP (Permiso Especial de Permanencia)" },
    { value: "48", label: "PPT (Permiso por Protección Temporal)" },
    { value: "50", label: "NIT de otro país" },
    { value: "91", label: "NUIP" },
];

/** Anexo 5.5.1 — Periodo de nómina. */
export const PERIODO_NOMINA_OPTIONS: CatalogOption[] = [
    { value: "1", label: "Semanal" },
    { value: "2", label: "Decenal" },
    { value: "3", label: "Catorcenal" },
    { value: "4", label: "Quincenal" },
    { value: "5", label: "Mensual" },
    { value: "6", label: "Otro" },
];

/** Anexo 5.5.2 — Tipo de contrato. */
export const TIPO_CONTRATO_OPTIONS: CatalogOption[] = [
    { value: "1", label: "Término fijo" },
    { value: "2", label: "Término indefinido" },
    { value: "3", label: "Obra o labor" },
    { value: "4", label: "Aprendizaje" },
    { value: "5", label: "Prácticas o pasantías" },
];

/** Anexo 5.5.3 — Tipo de trabajador. */
export const TIPO_TRABAJADOR_OPTIONS: CatalogOption[] = [
    { value: "01", label: "Dependiente" },
    { value: "02", label: "Servicio doméstico" },
    { value: "04", label: "Madre comunitaria" },
    { value: "12", label: "Aprendiz SENA en etapa lectiva" },
    { value: "18", label: "Funcionario público sin tope máximo de IBC" },
    { value: "19", label: "Aprendiz SENA en etapa productiva" },
    { value: "21", label: "Estudiante de postgrado en salud" },
    { value: "22", label: "Profesor de establecimiento particular" },
    { value: "23", label: "Estudiante (solo riesgos laborales)" },
    { value: "30", label: "Dependiente entidad/universidad pública régimen especial salud" },
    { value: "31", label: "Cooperado de cooperativa de trabajo asociado" },
    { value: "47", label: "Dependiente entidad beneficiaria SGP — aportes patronales" },
    { value: "51", label: "Trabajador de tiempo parcial" },
    { value: "54", label: "Pre-pensionado de entidad en liquidación" },
    { value: "56", label: "Pre-pensionado con aporte voluntario a salud" },
    { value: "58", label: "Estudiante de prácticas laborales sector público" },
];

/** Anexo 5.5.4 — Subtipo de trabajador. */
export const SUBTIPO_TRABAJADOR_OPTIONS: CatalogOption[] = [
    { value: "00", label: "No aplica" },
    { value: "01", label: "Dependiente pensionado por vejez activo" },
];

/** Anexo 5.5.5 — Porcentaje de hora extra / recargo. */
export const PORCENTAJE_HORA_EXTRA_OPTIONS: CatalogOption[] = [
    { value: "25.00", label: "Hora extra diurna (25%)" },
    { value: "75.00", label: "Hora extra nocturna (75%)" },
    { value: "35.00", label: "Recargo nocturno (35%)" },
    { value: "100.00", label: "Hora extra diurna dominical/festivo (100%)" },
    { value: "75.00DD", label: "Recargo diurno dominical/festivo (75%)" },
    { value: "150.00", label: "Hora extra nocturna dominical/festivo (150%)" },
    { value: "110.00", label: "Recargo nocturno dominical/festivo (110%)" },
];

/** Clave del tipo de hora extra → bloque/atributos que espera SIMBA. */
export const TIPO_HORA_EXTRA_OPTIONS: CatalogOption[] = [
    { value: "HED", label: "Extra diurna (25%)" },
    { value: "HEN", label: "Extra nocturna (75%)" },
    { value: "HRN", label: "Recargo nocturno (35%)" },
    { value: "HEDDF", label: "Extra diurna dominical/festivo (100%)" },
    { value: "HRDDF", label: "Recargo diurno dominical/festivo (75%)" },
    { value: "HENDF", label: "Extra nocturna dominical/festivo (150%)" },
    { value: "HRNDF", label: "Recargo nocturno dominical/festivo (110%)" },
];

/** Porcentaje DIAN asociado a cada tipo de hora extra. */
export const PORCENTAJE_POR_TIPO_HORA: Record<string, string> = {
    HED: "25.00",
    HEN: "75.00",
    HRN: "35.00",
    HEDDF: "100.00",
    HRDDF: "75.00",
    HENDF: "150.00",
    HRNDF: "110.00",
};

export const FORMA_PAGO_OPTIONS: CatalogOption[] = [
    { value: "1", label: "Contado" },
    { value: "2", label: "Crédito" },
];

/** Medios de pago DIAN (subconjunto usual de nómina). → Pago.Metodo */
export const METODO_PAGO_OPTIONS: CatalogOption[] = [
    { value: "10", label: "Efectivo" },
    { value: "42", label: "Transferencia / consignación bancaria" },
    { value: "47", label: "Transferencia débito bancaria" },
    { value: "20", label: "Cheque" },
    { value: "48", label: "Tarjeta crédito" },
    { value: "49", label: "Tarjeta débito" },
    { value: "1", label: "Otro / no definido" },
];

/** Tipo de cuenta bancaria del trabajador. → Pago.TipoCuenta */
export const TIPO_CUENTA_OPTIONS: CatalogOption[] = [
    { value: "AHORROS", label: "Ahorros" },
    { value: "CORRIENTE", label: "Corriente" },
];

/** Clase de riesgo ARL (define la tarifa de aporte del empleador). */
export const CLASE_RIESGO_ARL_OPTIONS: CatalogOption[] = [
    { value: "I", label: "Clase I — 0.522%" },
    { value: "II", label: "Clase II — 1.044%" },
    { value: "III", label: "Clase III — 2.436%" },
    { value: "IV", label: "Clase IV — 4.350%" },
    { value: "V", label: "Clase V — 6.960%" },
];

/** Anexo 5.5.6 — Tipo de incapacidad. */
export const TIPO_INCAPACIDAD_OPTIONS: CatalogOption[] = [
    { value: "1", label: "Común" },
    { value: "2", label: "Profesional" },
    { value: "3", label: "Laboral" },
];

export const labelFromCatalog = (options: CatalogOption[], value: string): string => options.find((o) => o.value === value)?.label ?? value;
