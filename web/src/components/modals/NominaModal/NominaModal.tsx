import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
    createNominaLote,
    getNominaPrefixes,
    type CreateNominaPayload,
    type HoraExtraInput,
    type LoteItemResult,
    type NominaPrefix,
    type PlantillaLote,
} from "../../../services/nomina.service";
import { getAllEmpleados, type Empleado } from "../../../services/empleados.service";
import { AppDrawer, FilterField, FieldControl } from "../../../components/design-system";
import {
    PERIODO_NOMINA_OPTIONS,
    PORCENTAJE_POR_TIPO_HORA,
    TIPO_HORA_EXTRA_OPTIONS,
} from "../../../features/nomina/nomina.constants";
import "../nomina-modals.css";

interface HoraExtraRow {
    tipo: string;
    cantidad: number;
    pago: number;
}

interface ConceptoSNSRow {
    pago_s: number;
    pago_ns: number;
}

/** Conceptos editables por trabajador dentro del lote. */
interface ConceptosTrabajador {
    dias_trabajados: number;
    auxilio_transporte: number;
    horas_extra: HoraExtraRow[];
    bonificaciones: ConceptoSNSRow[];
    auxilios: ConceptoSNSRow[];
    salud_porcentaje: number;
    pension_porcentaje: number;
}

interface NominaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    /** Si se pasa, precarga el formulario con los datos del lote anterior (mes siguiente). */
    plantilla?: PlantillaLote | null;
}

interface PeriodoForm {
    prefijo: string;
    fecha_liquidacion_inicio: string;
    fecha_liquidacion_fin: string;
    periodo_nomina: string;
    fecha_pago: string;
}

const emptyPeriodo = (): PeriodoForm => ({
    prefijo: "",
    fecha_liquidacion_inicio: "",
    fecha_liquidacion_fin: "",
    periodo_nomina: "5",
    fecha_pago: "",
});

const defaultConceptos = (): ConceptosTrabajador => ({
    dias_trabajados: 30,
    auxilio_transporte: 0,
    horas_extra: [],
    bonificaciones: [],
    auxilios: [],
    salud_porcentaje: 4,
    pension_porcentaje: 4,
});

const formatCOP = (value: number): string =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);

/** Clave de periodo "YYYY-MM" y etiqueta legible a partir de la fecha fin de liquidación. */
const buildPeriodoKey = (fechaFin: string): { key: string; label: string } => {
    if (!fechaFin) return { key: "", label: "" };
    const [y, m] = fechaFin.split("-");
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const idx = Math.max(0, Math.min(11, Number(m) - 1));
    return { key: `${y}-${m}`, label: `${meses[idx]} ${y}` };
};

/** Convierte un item de plantilla (CreateNominaPayload) a los conceptos editables del modal. */
const payloadToConceptos = (p: CreateNominaPayload): ConceptosTrabajador => {
    const d = p.devengados ?? { dias_trabajados: 30 };
    return {
        dias_trabajados: d.dias_trabajados ?? 30,
        auxilio_transporte: d.auxilio_transporte ?? 0,
        horas_extra: (d.horas_extra ?? []).map((h) => ({ tipo: h.Tipo ?? "HED", cantidad: Number(h.Cantidad) || 0, pago: Number(h.Pago) || 0 })),
        bonificaciones: (d.bonificaciones ?? []).map((b) => ({ pago_s: b.pago_s ?? 0, pago_ns: b.pago_ns ?? 0 })),
        auxilios: (d.auxilios ?? []).map((a) => ({ pago_s: a.pago_s ?? 0, pago_ns: a.pago_ns ?? 0 })),
        salud_porcentaje: p.deducciones?.salud?.porcentaje ?? 4,
        pension_porcentaje: p.deducciones?.fondo_pension?.porcentaje ?? 4,
    };
};

const NominaModal: React.FC<NominaModalProps> = ({ isOpen, onClose, onSuccess, plantilla }) => {
    const [loading, setLoading] = useState(false);
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [loadingEmpleados, setLoadingEmpleados] = useState(false);
    const [prefijos, setPrefijos] = useState<NominaPrefix[]>([]);
    const [periodo, setPeriodo] = useState<PeriodoForm>(emptyPeriodo);

    /** Empleados seleccionados (en orden) y sus conceptos por id. */
    const [seleccionados, setSeleccionados] = useState<string[]>([]);
    const [conceptos, setConceptos] = useState<Record<string, ConceptosTrabajador>>({});
    /** Id del trabajador cuyo panel de conceptos está expandido (acordeón). */
    const [expandido, setExpandido] = useState<string | null>(null);
    /** Resultados del último lote emitido (resumen por trabajador). */
    const [resultados, setResultados] = useState<LoteItemResult[] | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setResultados(null);
        setExpandido(null);

        // Precarga desde plantilla (mes siguiente) o formulario en blanco.
        if (plantilla && plantilla.items.length) {
            setPeriodo({
                prefijo: "",
                fecha_liquidacion_inicio: plantilla.items[0]?.periodo.fecha_liquidacion_inicio ?? "",
                fecha_liquidacion_fin: plantilla.items[0]?.periodo.fecha_liquidacion_fin ?? "",
                periodo_nomina: plantilla.periodo_nomina ?? "5",
                fecha_pago: plantilla.items[0]?.periodo.fechas_pago?.[0] ?? "",
            });
            const ids = plantilla.items.map((it) => it.empleadoId).filter(Boolean);
            setSeleccionados(ids);
            const conc: Record<string, ConceptosTrabajador> = {};
            plantilla.items.forEach((it) => { if (it.empleadoId) conc[it.empleadoId] = payloadToConceptos(it); });
            setConceptos(conc);
        } else {
            setPeriodo(emptyPeriodo());
            setSeleccionados([]);
            setConceptos({});
        }

        setLoadingEmpleados(true);
        (async () => {
            try {
                const res = await getAllEmpleados(1, 200);
                setEmpleados(res.items.filter((e) => e.active));
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Error al cargar empleados");
            } finally {
                setLoadingEmpleados(false);
            }
        })();
        (async () => {
            try {
                const list = await getNominaPrefixes();
                setPrefijos(list);
                const noPruebas = list.filter((p) => !/^NESET/i.test(p.prefix));
                const def = list.find((p) => p.default) ?? noPruebas[0] ?? list[0];
                if (def) setPeriodo((prev) => ({ ...prev, prefijo: def.prefix }));
            } catch {
                setPrefijos([]);
            }
        })();
    }, [isOpen, plantilla]);

    const empleadoById = useMemo(() => {
        const m = new Map<string, Empleado>();
        empleados.forEach((e) => m.set(e._id, e));
        return m;
    }, [empleados]);

    // ── Selección de trabajadores ──
    const toggleEmpleado = (id: string) => {
        setSeleccionados((prev) => {
            if (prev.includes(id)) {
                setConceptos((c) => {
                    const next = { ...c };
                    delete next[id];
                    return next;
                });
                if (expandido === id) setExpandido(null);
                return prev.filter((x) => x !== id);
            }
            setConceptos((c) => ({ ...c, [id]: defaultConceptos() }));
            return [...prev, id];
        });
    };

    const toggleTodos = () => {
        if (seleccionados.length === empleados.length) {
            setSeleccionados([]);
            setConceptos({});
            setExpandido(null);
        } else {
            const all = empleados.map((e) => e._id);
            setSeleccionados(all);
            setConceptos(() => {
                const next: Record<string, ConceptosTrabajador> = {};
                all.forEach((id) => (next[id] = defaultConceptos()));
                return next;
            });
        }
    };

    // ── Edición de conceptos de un trabajador ──
    const patchConcepto = (id: string, patch: Partial<ConceptosTrabajador>) =>
        setConceptos((c) => ({ ...c, [id]: { ...(c[id] ?? defaultConceptos()), ...patch } }));

    const calcTotales = (emp: Empleado, c: ConceptosTrabajador) => {
        const sueldoTrabajado = (emp.sueldo / 30) * c.dias_trabajados;
        const totalHE = c.horas_extra.reduce((s, h) => s + (h.pago || 0), 0);
        const totalBon = c.bonificaciones.reduce((s, b) => s + (b.pago_s || 0) + (b.pago_ns || 0), 0);
        const totalAux = c.auxilios.reduce((s, a) => s + (a.pago_s || 0) + (a.pago_ns || 0), 0);
        const baseS = sueldoTrabajado + totalHE + c.bonificaciones.reduce((s, b) => s + (b.pago_s || 0), 0) + c.auxilios.reduce((s, a) => s + (a.pago_s || 0), 0);
        const devengados = sueldoTrabajado + (c.auxilio_transporte || 0) + totalHE + totalBon + totalAux;
        const salud = Math.round((baseS * (c.salud_porcentaje || 0)) / 100);
        const pension = Math.round((baseS * (c.pension_porcentaje || 0)) / 100);
        const neto = devengados - salud - pension;
        return { sueldoTrabajado, devengados, salud, pension, neto };
    };

    const totalLote = useMemo(() => {
        return seleccionados.reduce((acc, id) => {
            const emp = empleadoById.get(id);
            const c = conceptos[id];
            if (!emp || !c) return acc;
            return acc + calcTotales(emp, c).neto;
        }, 0);
    }, [seleccionados, conceptos, empleadoById]);

    // ── Listas dinámicas por trabajador ──
    const addHoraExtra = (id: string) => patchConcepto(id, { horas_extra: [...(conceptos[id]?.horas_extra ?? []), { tipo: "HED", cantidad: 1, pago: 0 }] });
    const removeHoraExtra = (id: string, i: number) => patchConcepto(id, { horas_extra: (conceptos[id]?.horas_extra ?? []).filter((_, idx) => idx !== i) });
    const updateHoraExtra = (id: string, i: number, field: keyof HoraExtraRow, value: string | number) =>
        patchConcepto(id, { horas_extra: (conceptos[id]?.horas_extra ?? []).map((h, idx) => (idx === i ? { ...h, [field]: value } : h)) });

    const addConcepto = (id: string, key: "bonificaciones" | "auxilios") => patchConcepto(id, { [key]: [...(conceptos[id]?.[key] ?? []), { pago_s: 0, pago_ns: 0 }] } as Partial<ConceptosTrabajador>);
    const removeConcepto = (id: string, key: "bonificaciones" | "auxilios", i: number) => patchConcepto(id, { [key]: (conceptos[id]?.[key] ?? []).filter((_, idx) => idx !== i) } as Partial<ConceptosTrabajador>);
    const updateConcepto = (id: string, key: "bonificaciones" | "auxilios", i: number, field: keyof ConceptoSNSRow, value: number) =>
        patchConcepto(id, { [key]: (conceptos[id]?.[key] ?? []).map((c, idx) => (idx === i ? { ...c, [field]: value } : c)) } as Partial<ConceptosTrabajador>);

    const onlyNum = (raw: string) => Number(raw.replace(/[^\d.]/g, "")) || 0;

    // ── Emisión del lote ──
    const buildItem = (id: string): CreateNominaPayload => {
        const c = conceptos[id] ?? defaultConceptos();
        const emp = empleadoById.get(id);
        const { salud, pension } = calcTotales(emp!, c);
        const horasExtra: HoraExtraInput[] = c.horas_extra
            .filter((h) => h.pago > 0 || h.cantidad > 0)
            .map((h) => ({ Tipo: h.tipo, Cantidad: String(h.cantidad), Porcentaje: PORCENTAJE_POR_TIPO_HORA[h.tipo] ?? "25.00", Pago: String(h.pago) }));
        const bonificaciones = c.bonificaciones.filter((b) => b.pago_s > 0 || b.pago_ns > 0).map((b) => ({ pago_s: b.pago_s || 0, pago_ns: b.pago_ns || 0 }));
        const auxilios = c.auxilios.filter((a) => a.pago_s > 0 || a.pago_ns > 0).map((a) => ({ pago_s: a.pago_s || 0, pago_ns: a.pago_ns || 0 }));

        return {
            empleadoId: id,
            ...(periodo.prefijo ? { prefijo: periodo.prefijo } : {}),
            ...(emp?.datos_pago ? { pago: { forma: emp.datos_pago.forma, metodo: emp.datos_pago.metodo } } : {}),
            periodo: {
                fecha_liquidacion_inicio: periodo.fecha_liquidacion_inicio,
                fecha_liquidacion_fin: periodo.fecha_liquidacion_fin,
                periodo_nomina: periodo.periodo_nomina,
                fechas_pago: [periodo.fecha_pago],
            },
            devengados: {
                dias_trabajados: c.dias_trabajados,
                ...(c.auxilio_transporte ? { auxilio_transporte: c.auxilio_transporte } : {}),
                ...(horasExtra.length ? { horas_extra: horasExtra } : {}),
                ...(bonificaciones.length ? { bonificaciones } : {}),
                ...(auxilios.length ? { auxilios } : {}),
            },
            deducciones: {
                salud: { porcentaje: c.salud_porcentaje, deduccion: salud },
                fondo_pension: { porcentaje: c.pension_porcentaje, deduccion: pension },
            },
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!seleccionados.length) return toast.error("Selecciona al menos un trabajador");
        if (!periodo.fecha_liquidacion_inicio || !periodo.fecha_liquidacion_fin) return toast.error("Define el periodo de liquidación");
        if (!periodo.fecha_pago) return toast.error("Define la fecha de pago");
        if (seleccionados.some((id) => (conceptos[id]?.dias_trabajados ?? 0) <= 0)) return toast.error("Los días trabajados deben ser mayores a 0 en todos los trabajadores");

        const { key, label } = buildPeriodoKey(periodo.fecha_liquidacion_fin);
        const payload = {
            periodo_key: key,
            periodo_label: label,
            items: seleccionados.map(buildItem),
        };

        setLoading(true);
        try {
            const res = await createNominaLote(payload);
            setResultados(res.results);
            const ok = res.results.filter((r) => r.status === "APPROVED" || r.status === "SENT").length;
            const fail = res.results.filter((r) => r.status === "REJECTED" || r.status === "ERROR").length;
            if (fail === 0) toast.success(`${ok} nómina(s) emitida(s) correctamente`);
            else toast.error(`${ok} emitida(s), ${fail} con problemas. Revisa el detalle.`);
            onSuccess();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al emitir el lote de nómina");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const nombreEmpleado = (id: string) => {
        const e = empleadoById.get(id);
        return e ? `${e.primer_nombre} ${e.primer_apellido}` : id;
    };

    return (
        <AppDrawer
            wide
            title={plantilla ? `Emitir nómina · ${plantilla.periodo_label}` : "Emitir nómina"}
            titleIcon="ri-file-list-3-line"
            onClose={onClose}
            closeDisabled={loading}
            ariaLabelledBy="nomina-modal-title"
            footer={
                resultados ? (
                    <button type="button" className="export-cancel" onClick={onClose}>
                        Cerrar
                    </button>
                ) : (
                    <>
                        <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" form="nomina-form" className="export-submit" disabled={loading || seleccionados.length === 0}>
                            {loading ? (
                                <>
                                    <i className="ri-loader-4-line rotating" aria-hidden /> Emitiendo…
                                </>
                            ) : (
                                `Emitir ${seleccionados.length || ""} nómina(s)`
                            )}
                        </button>
                    </>
                )
            }
        >
                {resultados ? (
                    <div>
                        <div className="nomina-section">
                            <h3 className="nomina-section-title"><i className="ri-checkbox-multiple-line"></i> Resultado del lote</h3>
                            <div className="lote-result-list">
                                {resultados.map((r) => {
                                    const ok = r.status === "APPROVED" || r.status === "SENT";
                                    return (
                                        <div className={`lote-result-row ${ok ? "ok" : "fail"}`} key={r.empleadoId}>
                                            <i className={ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                                            <div className="lote-result-info">
                                                <strong>{nombreEmpleado(r.empleadoId)}</strong>
                                                <span>{r.numero ? `${r.numero} · ` : ""}{ok ? (r.status === "APPROVED" ? "Aprobada" : "Enviada") : (r.error || "Con problemas")}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <form id="nomina-form" onSubmit={handleSubmit}>
                        <p className="field-hint section-hint">
                            Selecciona uno o varios trabajadores, define el periodo común y ajusta los conceptos de cada uno. Cada nómina se emite por separado.
                        </p>

                        {/* Trabajadores */}
                        <div className="nomina-section">
                            <h3 className="nomina-section-title">
                                <i className="ri-team-line"></i> Trabajadores
                                <span className="nomina-section-count">{seleccionados.length} seleccionado(s)</span>
                            </h3>
                            {loadingEmpleados ? (
                                <p className="field-hint">Cargando empleados...</p>
                            ) : empleados.length === 0 ? (
                                <p className="field-hint">No hay empleados activos. Crea empleados primero.</p>
                            ) : (
                                <>
                                    <label className="checkbox-row" style={{ marginBottom: 4 }}>
                                        <input type="checkbox" checked={seleccionados.length === empleados.length && empleados.length > 0} onChange={toggleTodos} disabled={loading} />
                                        <span>Seleccionar todos</span>
                                    </label>
                                    <div className="empleado-picker">
                                        {empleados.map((emp) => {
                                            const sel = seleccionados.includes(emp._id);
                                            const c = conceptos[emp._id];
                                            const tot = sel && c ? calcTotales(emp, c) : null;
                                            return (
                                                <div className={`empleado-pick ${sel ? "sel" : ""}`} key={emp._id}>
                                                    <label className="empleado-pick-head">
                                                        <input type="checkbox" checked={sel} onChange={() => toggleEmpleado(emp._id)} disabled={loading} />
                                                        <span className="empleado-pick-name">{emp.primer_nombre} {emp.primer_apellido}</span>
                                                        <span className="empleado-pick-doc">{emp.numero_documento}</span>
                                                        {tot && <span className="empleado-pick-total">{formatCOP(tot.neto)}</span>}
                                                        {sel && (
                                                            <button type="button" className="btn-link" onClick={() => setExpandido(expandido === emp._id ? null : emp._id)} disabled={loading}>
                                                                {expandido === emp._id ? "Ocultar" : "Conceptos"}
                                                            </button>
                                                        )}
                                                    </label>

                                                    {sel && expandido === emp._id && c && (
                                                        <div className="empleado-pick-body">
                                                            <div className="led-form-grid">
                                                                <FilterField label="Días trabajados" htmlFor={`nomina-dias-${emp._id}`} icon="ri-calendar-line">
                                                                    <FieldControl
                                                                        id={`nomina-dias-${emp._id}`}
                                                                        type="number"
                                                                        min={1}
                                                                        max={31}
                                                                        value={c.dias_trabajados || ""}
                                                                        onChange={(e) => patchConcepto(emp._id, { dias_trabajados: onlyNum(e.target.value) })}
                                                                        disabled={loading}
                                                                    />
                                                                </FilterField>
                                                                <FilterField label="Auxilio de transporte" htmlFor={`nomina-aux-${emp._id}`} icon="ri-bus-line">
                                                                    <FieldControl
                                                                        id={`nomina-aux-${emp._id}`}
                                                                        inputMode="numeric"
                                                                        value={c.auxilio_transporte || ""}
                                                                        onChange={(e) => patchConcepto(emp._id, { auxilio_transporte: onlyNum(e.target.value) })}
                                                                        disabled={loading}
                                                                        placeholder="0"
                                                                    />
                                                                </FilterField>
                                                                <FilterField label="Salud (%)" htmlFor={`nomina-salud-${emp._id}`} icon="ri-heart-pulse-line">
                                                                    <FieldControl
                                                                        id={`nomina-salud-${emp._id}`}
                                                                        inputMode="numeric"
                                                                        value={c.salud_porcentaje || ""}
                                                                        onChange={(e) => patchConcepto(emp._id, { salud_porcentaje: onlyNum(e.target.value) })}
                                                                        disabled={loading}
                                                                        placeholder="4"
                                                                    />
                                                                </FilterField>
                                                                <FilterField label="Pensión (%)" htmlFor={`nomina-pension-${emp._id}`} icon="ri-shield-check-line">
                                                                    <FieldControl
                                                                        id={`nomina-pension-${emp._id}`}
                                                                        inputMode="numeric"
                                                                        value={c.pension_porcentaje || ""}
                                                                        onChange={(e) => patchConcepto(emp._id, { pension_porcentaje: onlyNum(e.target.value) })}
                                                                        disabled={loading}
                                                                        placeholder="4"
                                                                    />
                                                                </FilterField>
                                                            </div>

                                                            {/* Horas extra */}
                                                            <div className="concepto-list">
                                                                <div className="concepto-list-head">
                                                                    <span>Horas extra y recargos</span>
                                                                    <button type="button" className="btn-link" onClick={() => addHoraExtra(emp._id)} disabled={loading}><i className="ri-add-line"></i> Agregar</button>
                                                                </div>
                                                                {c.horas_extra.map((h, i) => (
                                                                    <div className="concepto-row" key={i}>
                                                                        <select value={h.tipo} onChange={(e) => updateHoraExtra(emp._id, i, "tipo", e.target.value)} disabled={loading} aria-label="Tipo de hora extra">
                                                                            {TIPO_HORA_EXTRA_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                                                                        </select>
                                                                        <input inputMode="numeric" value={h.cantidad || ""} onChange={(e) => updateHoraExtra(emp._id, i, "cantidad", onlyNum(e.target.value))} disabled={loading} placeholder="Cant." aria-label="Cantidad" />
                                                                        <input inputMode="numeric" value={h.pago || ""} onChange={(e) => updateHoraExtra(emp._id, i, "pago", onlyNum(e.target.value))} disabled={loading} placeholder="Valor $" aria-label="Pago" />
                                                                        <button type="button" className="btn-icon-danger" onClick={() => removeHoraExtra(emp._id, i)} disabled={loading} aria-label="Quitar"><i className="ri-delete-bin-line"></i></button>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Bonificaciones */}
                                                            <div className="concepto-list">
                                                                <div className="concepto-list-head">
                                                                    <span>Bonificaciones (S / NS)</span>
                                                                    <button type="button" className="btn-link" onClick={() => addConcepto(emp._id, "bonificaciones")} disabled={loading}><i className="ri-add-line"></i> Agregar</button>
                                                                </div>
                                                                {c.bonificaciones.map((b, i) => (
                                                                    <div className="concepto-row" key={i}>
                                                                        <input inputMode="numeric" value={b.pago_s || ""} onChange={(e) => updateConcepto(emp._id, "bonificaciones", i, "pago_s", onlyNum(e.target.value))} disabled={loading} placeholder="Salarial $" />
                                                                        <input inputMode="numeric" value={b.pago_ns || ""} onChange={(e) => updateConcepto(emp._id, "bonificaciones", i, "pago_ns", onlyNum(e.target.value))} disabled={loading} placeholder="No salarial $" />
                                                                        <button type="button" className="btn-icon-danger" onClick={() => removeConcepto(emp._id, "bonificaciones", i)} disabled={loading} aria-label="Quitar"><i className="ri-delete-bin-line"></i></button>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Auxilios */}
                                                            <div className="concepto-list">
                                                                <div className="concepto-list-head">
                                                                    <span>Auxilios (S / NS)</span>
                                                                    <button type="button" className="btn-link" onClick={() => addConcepto(emp._id, "auxilios")} disabled={loading}><i className="ri-add-line"></i> Agregar</button>
                                                                </div>
                                                                {c.auxilios.map((a, i) => (
                                                                    <div className="concepto-row" key={i}>
                                                                        <input inputMode="numeric" value={a.pago_s || ""} onChange={(e) => updateConcepto(emp._id, "auxilios", i, "pago_s", onlyNum(e.target.value))} disabled={loading} placeholder="Salarial $" />
                                                                        <input inputMode="numeric" value={a.pago_ns || ""} onChange={(e) => updateConcepto(emp._id, "auxilios", i, "pago_ns", onlyNum(e.target.value))} disabled={loading} placeholder="No salarial $" />
                                                                        <button type="button" className="btn-icon-danger" onClick={() => removeConcepto(emp._id, "auxilios", i)} disabled={loading} aria-label="Quitar"><i className="ri-delete-bin-line"></i></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Periodo común */}
                        <div className="nomina-section">
                            <h3 className="nomina-section-title"><i className="ri-calendar-line"></i> Periodo (común a todos)</h3>
                            <div className="led-form-grid">
                                <FilterField label="Prefijo (numeración)" htmlFor="nomina_prefijo" icon="ri-price-tag-3-line">
                                    {prefijos.length > 0 ? (
                                        <FieldControl as="select" id="nomina_prefijo" value={periodo.prefijo} onChange={(e) => setPeriodo((p) => ({ ...p, prefijo: e.target.value }))} disabled={loading}>
                                            {prefijos.map((p) => (<option key={p.prefix} value={p.prefix}>{p.prefix}{p.default ? " (por defecto)" : ""}</option>))}
                                        </FieldControl>
                                    ) : (
                                        <FieldControl id="nomina_prefijo" type="text" value="NESET (pruebas)" disabled readOnly />
                                    )}
                                </FilterField>
                                <FilterField label="Tipo de periodo *" htmlFor="periodo_nomina" icon="ri-calendar-2-line">
                                    <FieldControl as="select" id="periodo_nomina" value={periodo.periodo_nomina} onChange={(e) => setPeriodo((p) => ({ ...p, periodo_nomina: e.target.value }))} disabled={loading}>
                                        {PERIODO_NOMINA_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                                    </FieldControl>
                                </FilterField>
                                <FilterField label="Inicio del periodo *" htmlFor="fecha_liquidacion_inicio" icon="ri-calendar-line">
                                    <FieldControl id="fecha_liquidacion_inicio" type="date" value={periodo.fecha_liquidacion_inicio} onChange={(e) => setPeriodo((p) => ({ ...p, fecha_liquidacion_inicio: e.target.value }))} disabled={loading} />
                                </FilterField>
                                <FilterField label="Fin del periodo *" htmlFor="fecha_liquidacion_fin" icon="ri-calendar-check-line">
                                    <FieldControl id="fecha_liquidacion_fin" type="date" value={periodo.fecha_liquidacion_fin} onChange={(e) => setPeriodo((p) => ({ ...p, fecha_liquidacion_fin: e.target.value }))} disabled={loading} />
                                </FilterField>
                                <FilterField label="Fecha de pago *" htmlFor="fecha_pago" icon="ri-money-dollar-circle-line">
                                    <FieldControl id="fecha_pago" type="date" value={periodo.fecha_pago} onChange={(e) => setPeriodo((p) => ({ ...p, fecha_pago: e.target.value }))} disabled={loading} />
                                </FilterField>
                            </div>
                        </div>

                        {/* Total del lote */}
                        <div className="totales-card">
                            <div className="totales-row"><span>Trabajadores</span><span>{seleccionados.length}</span></div>
                            <div className="totales-row total"><span>Total neto del lote</span><span>{formatCOP(totalLote)}</span></div>
                        </div>
                    </form>
                )}
        </AppDrawer>
    );
};

export default NominaModal;
