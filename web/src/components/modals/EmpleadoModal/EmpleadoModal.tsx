import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createEmpleado, updateEmpleado, type Empleado, type EmpleadoInput } from "../../../services/empleados.service";
import SearchableSelect, { type SearchableSelectOption } from "../../shared/SearchableSelect/SearchableSelect";
import departamentos from "../../../utils/departamentos.json";
import municipios from "../../../utils/municipios.json";
import paises from "../../../utils/paises.json";
import { AppDrawer, FilterField, FieldControl } from "../../../components/design-system";
import {
    CLASE_RIESGO_ARL_OPTIONS,
    FORMA_PAGO_OPTIONS,
    METODO_PAGO_OPTIONS,
    SUBTIPO_TRABAJADOR_OPTIONS,
    TIPO_CONTRATO_OPTIONS,
    TIPO_CUENTA_OPTIONS,
    TIPO_DOCUMENTO_OPTIONS,
    TIPO_TRABAJADOR_OPTIONS,
} from "../../../features/nomina/nomina.constants";
import "../nomina-modals.css";

/** Métodos de pago que requieren datos bancarios (no efectivo/cheque). */
const METODOS_CON_CUENTA = new Set(["42", "47", "48", "49"]);

interface EmpleadoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    empleado?: Empleado | null;
}

const emptyForm = (): EmpleadoInput => ({
    tipo_documento: "13",
    numero_documento: "",
    primer_nombre: "",
    otros_nombres: "",
    primer_apellido: "",
    segundo_apellido: "",
    email: "",
    tipo_trabajador: "01",
    subtipo_trabajador: "00",
    tipo_contrato: "1",
    alto_riesgo_pension: false,
    salario_integral: false,
    sueldo: 0,
    fecha_ingreso: "",
    codigo_trabajador: "",
    lugar_trabajo: { pais: "169", departamento_codigo: "", ciudad_codigo: "", direccion: "" },
    datos_pago: { forma: "1", metodo: "10", banco: "", tipo_cuenta: "", numero_cuenta: "" },
    seguridad_social: { eps: "", afp: "", fondo_cesantias: "", caja_compensacion: "", clase_riesgo_arl: "" },
});

const toDateInput = (value?: string): string => {
    if (!value) return "";
    return value.slice(0, 10);
};

const EmpleadoModal: React.FC<EmpleadoModalProps> = ({ isOpen, onClose, onSuccess, empleado }) => {
    const isEditMode = !!empleado;
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState<EmpleadoInput>(emptyForm);

    useEffect(() => {
        if (empleado) {
            setForm({
                tipo_documento: empleado.tipo_documento,
                numero_documento: empleado.numero_documento,
                primer_nombre: empleado.primer_nombre,
                otros_nombres: empleado.otros_nombres ?? "",
                primer_apellido: empleado.primer_apellido,
                segundo_apellido: empleado.segundo_apellido ?? "",
                email: empleado.email ?? "",
                tipo_trabajador: empleado.tipo_trabajador,
                subtipo_trabajador: empleado.subtipo_trabajador,
                tipo_contrato: empleado.tipo_contrato,
                alto_riesgo_pension: empleado.alto_riesgo_pension,
                salario_integral: empleado.salario_integral,
                sueldo: empleado.sueldo,
                fecha_ingreso: toDateInput(empleado.fecha_ingreso),
                codigo_trabajador: empleado.codigo_trabajador ?? "",
                lugar_trabajo: empleado.lugar_trabajo ?? { pais: "169", departamento_codigo: "", ciudad_codigo: "", direccion: "" },
                datos_pago: empleado.datos_pago ?? { forma: "1", metodo: "10", banco: "", tipo_cuenta: "", numero_cuenta: "" },
                seguridad_social: empleado.seguridad_social ?? { eps: "", afp: "", fondo_cesantias: "", caja_compensacion: "", clase_riesgo_arl: "" },
            });
        } else {
            setForm(emptyForm());
        }
    }, [empleado, isOpen]);

    const paisesOptions: SearchableSelectOption[] = useMemo(() => paises.map((p) => ({ value: p.codigo, label: p.descripcion })), []);
    const departamentosOptions: SearchableSelectOption[] = useMemo(() => departamentos.map((d) => ({ value: d.codigo, label: d.nombre })), []);
    const municipiosOptions: SearchableSelectOption[] = useMemo(() => {
        const dept = form.lugar_trabajo?.departamento_codigo;
        if (!dept) return [];
        return municipios.filter((m) => m.code.startsWith(dept)).map((m) => ({ value: m.code, label: m.name }));
    }, [form.lugar_trabajo?.departamento_codigo]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setForm((prev) => ({ ...prev, [name]: checked }));
            return;
        }
        if (name === "sueldo") {
            setForm((prev) => ({ ...prev, sueldo: Number(value.replace(/[^\d.]/g, "")) || 0 }));
            return;
        }
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleLugarChange = (field: "pais" | "departamento_codigo" | "ciudad_codigo") => (code: string) => {
        setForm((prev) => {
            const lugar = { ...(prev.lugar_trabajo ?? { pais: "169", departamento_codigo: "", ciudad_codigo: "", direccion: "" }), [field]: code };
            if (field === "departamento_codigo") lugar.ciudad_codigo = "";
            return { ...prev, lugar_trabajo: lugar };
        });
    };

    const handlePagoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            datos_pago: { ...(prev.datos_pago ?? { forma: "1", metodo: "10" }), [name]: value },
        }));
    };

    const handleSeguridadChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            seguridad_social: { ...(prev.seguridad_social ?? {}), [name]: value },
        }));
    };

    const requiereCuenta = METODOS_CON_CUENTA.has(form.datos_pago?.metodo ?? "");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.numero_documento.trim() || !form.primer_nombre.trim() || !form.primer_apellido.trim()) {
            toast.error("Documento, primer nombre y primer apellido son obligatorios");
            return;
        }
        if (!form.sueldo || form.sueldo <= 0) {
            toast.error("El sueldo debe ser mayor a 0");
            return;
        }
        if (!form.fecha_ingreso) {
            toast.error("La fecha de ingreso es obligatoria");
            return;
        }
        if (requiereCuenta && !form.datos_pago?.numero_cuenta?.trim()) {
            toast.error("Indica el número de cuenta para el método de pago seleccionado");
            return;
        }

        setLoading(true);
        try {
            if (isEditMode && empleado) {
                await updateEmpleado(empleado._id, form);
                toast.success("Empleado actualizado correctamente");
            } else {
                await createEmpleado(form);
                toast.success("Empleado creado correctamente");
            }
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al guardar el empleado");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AppDrawer
            wide
            title={isEditMode ? "Editar empleado" : "Nuevo empleado"}
            titleIcon={isEditMode ? "ri-edit-line" : "ri-user-add-line"}
            onClose={onClose}
            closeDisabled={loading}
            ariaLabelledBy="empleado-modal-title"
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="submit" form="empleado-form" className="export-submit" disabled={loading}>
                        {loading ? (
                            <>
                                <i className="ri-loader-4-line rotating" aria-hidden /> {isEditMode ? "Actualizando…" : "Creando…"}
                            </>
                        ) : isEditMode ? (
                            "Actualizar"
                        ) : (
                            "Crear"
                        )}
                    </button>
                </>
            }
        >
            <form id="empleado-form" onSubmit={handleSubmit}>
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-id-card-line"></i> Identificación</h3>
                        <div className="led-form-grid">
                            <FilterField label="Tipo de documento *" htmlFor="tipo_documento" icon="ri-id-card-line">
                                <FieldControl id="tipo_documento" name="tipo_documento" as="select" value={form.tipo_documento} onChange={handleChange} disabled={loading || isEditMode}>
                                    {TIPO_DOCUMENTO_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Número de documento *" htmlFor="numero_documento" icon="ri-barcode-line">
                                <FieldControl id="numero_documento" name="numero_documento" value={form.numero_documento} onChange={handleChange} disabled={loading || isEditMode} inputMode="numeric" placeholder="1234567890" />
                            </FilterField>
                            <FilterField label="Primer nombre *" htmlFor="primer_nombre" icon="ri-user-line">
                                <FieldControl id="primer_nombre" name="primer_nombre" value={form.primer_nombre} onChange={handleChange} disabled={loading} placeholder="Juan" />
                            </FilterField>
                            <FilterField label="Otros nombres" htmlFor="otros_nombres" icon="ri-user-line">
                                <FieldControl id="otros_nombres" name="otros_nombres" value={form.otros_nombres} onChange={handleChange} disabled={loading} placeholder="Carlos" />
                            </FilterField>
                            <FilterField label="Primer apellido *" htmlFor="primer_apellido" icon="ri-user-line">
                                <FieldControl id="primer_apellido" name="primer_apellido" value={form.primer_apellido} onChange={handleChange} disabled={loading} placeholder="Pérez" />
                            </FilterField>
                            <FilterField label="Segundo apellido" htmlFor="segundo_apellido" icon="ri-user-line">
                                <FieldControl id="segundo_apellido" name="segundo_apellido" value={form.segundo_apellido} onChange={handleChange} disabled={loading} placeholder="Gómez" />
                            </FilterField>
                            <FilterField className="led-form-grid__full" label="Correo electrónico" htmlFor="email" icon="ri-mail-line">
                                <FieldControl id="email" name="email" type="email" value={form.email} onChange={handleChange} disabled={loading} placeholder="empleado@correo.com" />
                            </FilterField>
                        </div>
                    </div>

                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-briefcase-line"></i> Datos laborales</h3>
                        <div className="led-form-grid">
                            <FilterField label="Tipo de trabajador *" htmlFor="tipo_trabajador" icon="ri-briefcase-line">
                                <FieldControl id="tipo_trabajador" name="tipo_trabajador" as="select" value={form.tipo_trabajador} onChange={handleChange} disabled={loading}>
                                    {TIPO_TRABAJADOR_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Subtipo de trabajador *" htmlFor="subtipo_trabajador" icon="ri-group-line">
                                <FieldControl id="subtipo_trabajador" name="subtipo_trabajador" as="select" value={form.subtipo_trabajador} onChange={handleChange} disabled={loading}>
                                    {SUBTIPO_TRABAJADOR_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Tipo de contrato *" htmlFor="tipo_contrato" icon="ri-file-list-line">
                                <FieldControl id="tipo_contrato" name="tipo_contrato" as="select" value={form.tipo_contrato} onChange={handleChange} disabled={loading}>
                                    {TIPO_CONTRATO_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Sueldo base mensual *" htmlFor="sueldo" icon="ri-money-dollar-circle-line">
                                <FieldControl id="sueldo" name="sueldo" value={form.sueldo ? String(form.sueldo) : ""} onChange={handleChange} disabled={loading} inputMode="numeric" placeholder="1300000" />
                            </FilterField>
                            <FilterField label="Fecha de ingreso *" htmlFor="fecha_ingreso" icon="ri-calendar-line">
                                <FieldControl id="fecha_ingreso" name="fecha_ingreso" type="date" value={form.fecha_ingreso} onChange={handleChange} disabled={loading} />
                            </FilterField>
                            <FilterField label="Código de trabajador" htmlFor="codigo_trabajador" icon="ri-barcode-line">
                                <FieldControl id="codigo_trabajador" name="codigo_trabajador" value={form.codigo_trabajador} onChange={handleChange} disabled={loading} placeholder="(por defecto el documento)" />
                            </FilterField>
                            <div className="checkbox-row">
                                <input id="alto_riesgo_pension" name="alto_riesgo_pension" type="checkbox" checked={form.alto_riesgo_pension} onChange={handleChange} disabled={loading} />
                                <label htmlFor="alto_riesgo_pension">Alto riesgo de pensión</label>
                            </div>
                            <div className="checkbox-row">
                                <input id="salario_integral" name="salario_integral" type="checkbox" checked={form.salario_integral} onChange={handleChange} disabled={loading} />
                                <label htmlFor="salario_integral">Salario integral</label>
                            </div>
                        </div>
                    </div>

                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-map-pin-line"></i> Lugar de trabajo</h3>
                        <div className="info-box">
                            <i className="ri-information-line"></i>
                            <p>Opcional. Si lo dejas vacío, se usará la ubicación registrada de la empresa al emitir la nómina.</p>
                        </div>
                        <div className="led-form-grid">
                            <FilterField label="País" htmlFor="lt_pais" icon="ri-global-line">
                                <SearchableSelect id="lt_pais" embedded options={paisesOptions} value={form.lugar_trabajo?.pais ?? ""} onChange={handleLugarChange("pais")} placeholder="Buscar país..." disabled={loading} aria-label="País" />
                            </FilterField>
                            <FilterField label="Departamento" htmlFor="lt_depto" icon="ri-map-2-line">
                                <SearchableSelect id="lt_depto" embedded options={departamentosOptions} value={form.lugar_trabajo?.departamento_codigo ?? ""} onChange={handleLugarChange("departamento_codigo")} placeholder="Buscar departamento..." disabled={loading} aria-label="Departamento" />
                            </FilterField>
                            <FilterField label="Ciudad / Municipio" htmlFor="lt_ciudad" icon="ri-building-2-line">
                                <SearchableSelect id="lt_ciudad" embedded options={municipiosOptions} value={form.lugar_trabajo?.ciudad_codigo ?? ""} onChange={handleLugarChange("ciudad_codigo")} placeholder="Buscar ciudad..." disabled={loading || !form.lugar_trabajo?.departamento_codigo} aria-label="Ciudad" />
                            </FilterField>
                            <FilterField label="Dirección" htmlFor="lt_direccion" icon="ri-map-pin-line">
                                <FieldControl id="lt_direccion" value={form.lugar_trabajo?.direccion ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, lugar_trabajo: { ...(prev.lugar_trabajo ?? { pais: "169", departamento_codigo: "", ciudad_codigo: "", direccion: "" }), direccion: e.target.value } }))} disabled={loading} placeholder="Calle 123 #45-67" />
                            </FilterField>
                        </div>
                    </div>

                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-bank-card-line"></i> Forma de pago</h3>
                        <div className="led-form-grid">
                            <FilterField label="Forma de pago *" htmlFor="dp_forma" icon="ri-bank-card-line">
                                <FieldControl id="dp_forma" name="forma" as="select" value={form.datos_pago?.forma ?? "1"} onChange={handlePagoChange} disabled={loading}>
                                    {FORMA_PAGO_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Método de pago *" htmlFor="dp_metodo" icon="ri-wallet-3-line">
                                <FieldControl id="dp_metodo" name="metodo" as="select" value={form.datos_pago?.metodo ?? "10"} onChange={handlePagoChange} disabled={loading}>
                                    {METODO_PAGO_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </FieldControl>
                            </FilterField>
                            {requiereCuenta && (
                                <>
                                    <FilterField label="Banco" htmlFor="dp_banco" icon="ri-bank-line">
                                        <FieldControl id="dp_banco" name="banco" value={form.datos_pago?.banco ?? ""} onChange={handlePagoChange} disabled={loading} placeholder="Bancolombia, Davivienda..." />
                                    </FilterField>
                                    <FilterField label="Tipo de cuenta" htmlFor="dp_tipo_cuenta" icon="ri-wallet-3-line">
                                        <FieldControl id="dp_tipo_cuenta" name="tipo_cuenta" as="select" value={form.datos_pago?.tipo_cuenta ?? ""} onChange={handlePagoChange} disabled={loading}>
                                            <option value="">— Selecciona —</option>
                                            {TIPO_CUENTA_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </FieldControl>
                                    </FilterField>
                                    <FilterField label="Número de cuenta" htmlFor="dp_numero_cuenta" icon="ri-bank-card-line">
                                        <FieldControl id="dp_numero_cuenta" name="numero_cuenta" value={form.datos_pago?.numero_cuenta ?? ""} onChange={handlePagoChange} disabled={loading} inputMode="numeric" placeholder="000-000000-00" />
                                    </FilterField>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-heart-pulse-line"></i> Seguridad social</h3>
                        <div className="info-box">
                            <i className="ri-information-line"></i>
                            <p>No viaja en el documento de la DIAN; se usa para calcular deducciones, aportes y la PILA.</p>
                        </div>
                        <div className="led-form-grid">
                            <FilterField label="EPS (salud)" htmlFor="ss_eps" icon="ri-heart-pulse-line">
                                <FieldControl id="ss_eps" name="eps" value={form.seguridad_social?.eps ?? ""} onChange={handleSeguridadChange} disabled={loading} placeholder="Sura, Nueva EPS..." />
                            </FilterField>
                            <FilterField label="Fondo de pensión (AFP)" htmlFor="ss_afp" icon="ri-shield-user-line">
                                <FieldControl id="ss_afp" name="afp" value={form.seguridad_social?.afp ?? ""} onChange={handleSeguridadChange} disabled={loading} placeholder="Porvenir, Colfondos..." />
                            </FilterField>
                            <FilterField label="Fondo de cesantías" htmlFor="ss_cesantias" icon="ri-safe-line">
                                <FieldControl id="ss_cesantias" name="fondo_cesantias" value={form.seguridad_social?.fondo_cesantias ?? ""} onChange={handleSeguridadChange} disabled={loading} placeholder="Protección, Porvenir..." />
                            </FilterField>
                            <FilterField label="Caja de compensación (CCF)" htmlFor="ss_ccf" icon="ri-community-line">
                                <FieldControl id="ss_ccf" name="caja_compensacion" value={form.seguridad_social?.caja_compensacion ?? ""} onChange={handleSeguridadChange} disabled={loading} placeholder="Comfama, Compensar..." />
                            </FilterField>
                            <FilterField label="Clase de riesgo ARL" htmlFor="ss_arl" icon="ri-shield-check-line">
                                <FieldControl id="ss_arl" name="clase_riesgo_arl" as="select" value={form.seguridad_social?.clase_riesgo_arl ?? ""} onChange={handleSeguridadChange} disabled={loading}>
                                    <option value="">— Selecciona —</option>
                                    {CLASE_RIESGO_ARL_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </FieldControl>
                            </FilterField>
                        </div>
                    </div>

                    {isEditMode && (
                        <div className="info-box">
                            <i className="ri-information-line"></i>
                            <p>El tipo y número de documento no se pueden modificar una vez creado el empleado.</p>
                        </div>
                    )}

            </form>
        </AppDrawer>
    );
};

export default EmpleadoModal;
