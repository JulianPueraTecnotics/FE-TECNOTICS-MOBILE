import { API_ROUTES } from "../utils/global";

export interface LugarTrabajo {
    pais: string;
    departamento_codigo: string;
    ciudad_codigo: string;
    direccion: string;
}

/** Datos de pago del trabajador → bloque <Pago> de SIMBA. */
export interface DatosPago {
    forma: string;          // "1" Contado | "2" Crédito → Pago.Forma
    metodo: string;         // medio de pago DIAN → Pago.Metodo
    banco?: string;         // → Pago.Banco
    tipo_cuenta?: string;   // "AHORROS" | "CORRIENTE" → Pago.TipoCuenta
    numero_cuenta?: string; // → Pago.NumeroCuenta
}

/** Entidades de seguridad social (uso interno del motor: deducciones, aportes y PILA). */
export interface SeguridadSocial {
    eps?: string;                 // entidad de salud
    afp?: string;                 // fondo de pensión
    fondo_cesantias?: string;
    caja_compensacion?: string;   // CCF
    clase_riesgo_arl?: string;    // "I".."V" → tarifa ARL del empleador
}

export interface Empleado {
    _id: string;
    company_id: string;
    tipo_documento: string;
    numero_documento: string;
    primer_nombre: string;
    otros_nombres?: string;
    primer_apellido: string;
    segundo_apellido?: string;
    email?: string;
    tipo_trabajador: string;
    subtipo_trabajador: string;
    tipo_contrato: string;
    alto_riesgo_pension: boolean;
    salario_integral: boolean;
    sueldo: number;
    fecha_ingreso: string;
    codigo_trabajador?: string;
    lugar_trabajo?: LugarTrabajo;
    datos_pago?: DatosPago;
    seguridad_social?: SeguridadSocial;
    active: boolean;
    created: string;
}

export type EmpleadoInput = Omit<Empleado, "_id" | "company_id" | "active" | "created"> & { active?: boolean };

export interface EmpleadosResponse {
    items: Empleado[];
    total: number;
    page: number;
    limit: number;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const getAllEmpleados = async (page = 1, limit = 20): Promise<EmpleadosResponse> => {
    const response = await fetch(`${API_ROUTES.EMPLEADOS}?page=${page}&limit=${limit}`, {
        method: "GET",
        credentials: "include",
        headers: jsonHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al obtener empleados");
    return data;
};

/**
 * Trae TODOS los empleados recorriendo la paginación. Útil para la importación masiva,
 * donde necesitamos el set completo de documentos para decidir crear vs. actualizar.
 */
export const getAllEmpleadosFull = async (): Promise<Empleado[]> => {
    const pageSize = 100;
    const first = await getAllEmpleados(1, pageSize);
    const all = [...first.items];
    const totalPages = Math.max(1, Math.ceil(first.total / pageSize));
    for (let page = 2; page <= totalPages; page++) {
        const res = await getAllEmpleados(page, pageSize);
        all.push(...res.items);
    }
    return all;
};

export const getEmpleadoById = async (empleadoId: string): Promise<{ empleado: Empleado }> => {
    const response = await fetch(API_ROUTES.EMPLEADO_BY_ID(empleadoId), {
        method: "GET",
        credentials: "include",
        headers: jsonHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al obtener el empleado");
    return data;
};

export const createEmpleado = async (input: EmpleadoInput): Promise<{ empleado: Empleado }> => {
    const response = await fetch(API_ROUTES.EMPLEADOS, {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al crear el empleado");
    return data;
};

export const updateEmpleado = async (empleadoId: string, input: Partial<EmpleadoInput>): Promise<{ empleado: Empleado }> => {
    const response = await fetch(API_ROUTES.EMPLEADO_BY_ID(empleadoId), {
        method: "PUT",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al actualizar el empleado");
    return data;
};

export const deleteEmpleado = async (empleadoId: string): Promise<{ message: string }> => {
    const response = await fetch(API_ROUTES.EMPLEADO_BY_ID(empleadoId), {
        method: "DELETE",
        credentials: "include",
        headers: jsonHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al eliminar el empleado");
    return data;
};
