import { useCallback, useEffect, useState } from "react";
import { getIcaPorMunicipio, type IcaMunicipioResponse } from "../dian.service";
import { downloadRowsXlsx } from "../../accounting/import.utils";
import { errorToast } from "../../../components/shared/toast/toasts";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const thisYear = new Date().getFullYear();

const IcaMunicipio: React.FC = () => {
    const [anio, setAnio] = useState(thisYear);
    const [data, setData] = useState<IcaMunicipioResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getIcaPorMunicipio(anio));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar el ICA por municipio");
        } finally {
            setLoading(false);
        }
    }, [anio]);

    useEffect(() => { load(); }, [load]);

    /** Exporta el detalle plano (una fila por tercero, con su municipio) para la exógena distrital. */
    const exportAll = () => {
        if (!data?.municipios.length) { errorToast("Sin datos para exportar"); return; }
        const rows = data.municipios.flatMap((m) =>
            m.rows.map((r) => [m.municipio, r.nit || "", r.dv ?? "", r.tercero, r.identificado ? "Sí" : "No", String(r.valor)]),
        );
        downloadRowsXlsx(
            `reteica-municipio-${anio}.xlsx`,
            ["Municipio", "NIT", "DV", "Tercero", "Identificado", "ReteICA"],
            rows,
            `ReteICA ${anio}`,
        );
    };

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>ReteICA por municipio</h2>
                    <p className="acc-sub">Retención de ICA practicada, agrupada por el municipio del tercero. Insumo para la exógena distrital (Bogotá, Medellín, Cali, etc.).</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Año gravable</label><input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value) || thisYear)} /></div>
                    <button className="btn-secondary" onClick={exportAll} disabled={!data?.municipios.length}><i className="ri-file-excel-2-line" /> Excel</button>
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : !data || data.municipios.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>
                    No hay ReteICA practicada en {anio}. Configura conceptos de retención tipo <strong>ICA</strong> (con su cuenta, normalmente 2368xx) y contabiliza compras que la apliquen.
                </p>
            ) : (
                <>
                    <div className="ica-summary" style={{ display: "flex", gap: 16, margin: "12px 0 4px" }}>
                        <div className="ica-kpi"><span className="acc-sub">Total ReteICA {anio}</span><strong style={{ fontSize: "1.25rem" }}>{money(data.total)}</strong></div>
                        <div className="ica-kpi"><span className="acc-sub">Municipios</span><strong style={{ fontSize: "1.25rem" }}>{data.municipios.length}</strong></div>
                        {data.sin_identificar > 0 && (
                            <div className="ica-kpi"><span className="acc-sub">Terceros sin NIT</span><strong style={{ fontSize: "1.25rem", color: "var(--tertiary-color)" }}>{data.sin_identificar}</strong></div>
                        )}
                    </div>

                    <table className="acc-table" style={{ marginTop: 8 }}>
                        <thead>
                            <tr><th>Municipio</th><th style={{ textAlign: "right" }}>Terceros</th><th style={{ textAlign: "right" }}>ReteICA</th><th></th></tr>
                        </thead>
                        <tbody>
                            {data.municipios.map((m) => {
                                const isOpen = open === m.codigo_municipio;
                                const sinMun = m.codigo_municipio === "—";
                                return (
                                    <>
                                        <tr key={m.codigo_municipio}>
                                            <td>
                                                {sinMun
                                                    ? <span title="Terceros sin código de municipio en su dirección"><i className="ri-error-warning-line" style={{ color: "var(--tertiary-color)" }} /> Sin municipio</span>
                                                    : <><strong>{m.codigo_municipio}</strong> — {m.municipio}</>}
                                            </td>
                                            <td style={{ textAlign: "right" }}>{m.terceros}</td>
                                            <td style={{ textAlign: "right", fontWeight: 600 }}>{money(m.total)}</td>
                                            <td style={{ textAlign: "right" }}>
                                                <button className="btn-action" onClick={() => setOpen(isOpen ? null : m.codigo_municipio)}>
                                                    <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} /> {isOpen ? "Ocultar" : "Detalle"}
                                                </button>
                                            </td>
                                        </tr>
                                        {isOpen && (
                                            <tr key={`${m.codigo_municipio}-det`}>
                                                <td colSpan={4} style={{ background: "var(--bg-subtle, rgba(0,0,0,.02))", padding: 0 }}>
                                                    <table className="acc-table" style={{ margin: 0 }}>
                                                        <thead><tr><th>NIT</th><th>Tercero</th><th style={{ textAlign: "right" }}>ReteICA</th><th></th></tr></thead>
                                                        <tbody>
                                                            {m.rows.map((r, i) => (
                                                                <tr key={i}>
                                                                    <td>{r.nit || "—"}</td>
                                                                    <td>{r.tercero}</td>
                                                                    <td style={{ textAlign: "right" }}>{money(r.valor)}</td>
                                                                    <td>{r.identificado ? <span className="status-badge status-paid">✓</span> : <span className="status-badge status-rejected" title="Sin NIT en el maestro de terceros">sin NIT</span>}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="acc-sub" style={{ marginTop: 12 }}>
                        El municipio se toma del código de municipio de la dirección del tercero. Los que aparecen en <strong>"Sin municipio"</strong> debes completarlos en Terceros para que la exógena distrital quede correcta.
                    </p>
                </>
            )}
        </div>
    );
};

export default IcaMunicipio;
