import { useCallback, useEffect, useState } from "react";
import { getRetentionParties, getExogena, getExogenaValidacion, downloadRetentionCertificate, downloadExogenaXml, type RetentionParty, type ExogenaResponse, type ExogenaValidacionRow } from "../dian.service";
import { downloadRowsXlsx } from "../../accounting/import.utils";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const thisYear = new Date().getFullYear();

const DianExogena: React.FC = () => {
    const [tab, setTab] = useState<"certificados" | "exogena">("certificados");
    const [anio, setAnio] = useState(thisYear);
    const [parties, setParties] = useState<RetentionParty[]>([]);
    const [exo, setExo] = useState<ExogenaResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [validaciones, setValidaciones] = useState<ExogenaValidacionRow[] | null>(null);
    const [validando, setValidando] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (tab === "certificados") {
                const res = await getRetentionParties(anio);
                setParties(res.parties);
            } else {
                setValidaciones(null);
                setExo(await getExogena(anio));
            }
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [tab, anio]);

    useEffect(() => { load(); }, [load]);

    const onCert = async (tercero: string) => {
        setBusy(tercero);
        try {
            await downloadRetentionCertificate(anio, tercero);
            successToast("Certificado generado");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusy(null);
        }
    };

    const exportFormato = (codigo: string) => {
        if (!exo) return;
        const f = exo.formatos[codigo];
        if (!f?.rows.length) { errorToast("Sin datos para exportar"); return; }
        downloadRowsXlsx(
            `exogena-${codigo}-${anio}.xlsx`,
            ["NIT", "DV", "Tipo doc", "Tercero", "Municipio", "Identificado", "Valor"],
            f.rows.map((r) => [r.nit, r.dv ?? "", r.tipo_doc ?? "", r.tercero, r.municipio ?? "", r.identificado ? "Sí" : "No", String(r.valor)]),
            `Formato ${codigo}`,
        );
    };

    const exportXml = async (codigo: string) => {
        try {
            await downloadExogenaXml(anio, codigo);
            successToast("XML generado");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al generar el XML");
        }
    };

    const validar = async () => {
        setValidando(true);
        try {
            const res = await getExogenaValidacion(anio);
            setValidaciones(res.validaciones);
            const conAlerta = res.validaciones.filter((v) => !v.cuadra).length;
            if (conAlerta === 0) successToast("Todos los formatos cuadran ✓");
            else errorToast(`${conAlerta} formato(s) con alertas. Revisa el detalle.`);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al validar");
        } finally {
            setValidando(false);
        }
    };

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>DIAN — Certificados y exógena</h2>
                    <p className="acc-sub">Certificados de retención por tercero y formatos de información exógena (medios magnéticos) para revisión.</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Año gravable</label><input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value) || thisYear)} /></div>
                </div>
            </div>

            <div className="led-tabs">
                <button className={tab === "certificados" ? "active" : ""} onClick={() => setTab("certificados")}>Certificados de retención</button>
                <button className={tab === "exogena" ? "active" : ""} onClick={() => setTab("exogena")}>Información exógena</button>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : tab === "certificados" ? (
                parties.length === 0 ? (
                    <p className="acc-sub" style={{ marginTop: 16 }}>No hay retenciones practicadas en {anio}. Configura los conceptos de retención (con su cuenta) y contabiliza comprobantes que las apliquen.</p>
                ) : (
                    <table className="acc-table" style={{ marginTop: 12 }}>
                        <thead><tr><th>Tercero</th><th>Conceptos</th><th style={{ textAlign: "right" }}>Total retenido</th><th></th></tr></thead>
                        <tbody>
                            {parties.map((p) => (
                                <tr key={p.tercero}>
                                    <td>{p.tercero}</td>
                                    <td style={{ color: "var(--text-muted)", fontSize: ".85rem" }}>{p.conceptos.map((c) => c.descripcion || c.cuenta).join(", ")}</td>
                                    <td style={{ textAlign: "right", fontWeight: 600 }}>{money(p.total_retenido)}</td>
                                    <td style={{ textAlign: "right" }}>
                                        <button className="btn-action" onClick={() => onCert(p.tercero)} disabled={busy === p.tercero}>
                                            <i className="ri-file-pdf-line" /> {busy === p.tercero ? "Generando..." : "Certificado PDF"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
            ) : !exo ? null : (
                <div style={{ marginTop: 12 }}>
                    <div className="dian-validacion-bar">
                        <button className="btn-secondary" onClick={validar} disabled={validando}>
                            <i className="ri-shield-check-line" /> {validando ? "Validando..." : "Validar cuadres"}
                        </button>
                        <span className="acc-sub">Compara cada formato contra la contabilidad y detecta terceros sin NIT antes de presentar.</span>
                    </div>

                    {validaciones && (
                        <div className="dian-validacion">
                            <table className="acc-table">
                                <thead>
                                    <tr>
                                        <th>Formato</th>
                                        <th style={{ textAlign: "right" }}>Contable</th>
                                        <th style={{ textAlign: "right" }}>Formato</th>
                                        <th style={{ textAlign: "right" }}>Identificado (XML)</th>
                                        <th style={{ textAlign: "right" }}>Diferencia</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {validaciones.map((v) => (
                                        <tr key={v.codigo}>
                                            <td><strong>{v.codigo}</strong> {v.nombre}</td>
                                            <td style={{ textAlign: "right" }}>{money(v.total_contable)}</td>
                                            <td style={{ textAlign: "right" }}>{money(v.total_formato)}</td>
                                            <td style={{ textAlign: "right" }}>{money(v.total_identificado)}</td>
                                            <td style={{ textAlign: "right", color: Math.abs(v.diferencia) > 1 ? "var(--tertiary-color)" : undefined }}>{money(v.diferencia)}</td>
                                            <td>
                                                {v.cuadra ? (
                                                    <span className="status-badge status-paid">Cuadra ✓</span>
                                                ) : (
                                                    <span className="status-badge status-rejected">Revisar</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {validaciones.some((v) => v.alertas.length > 0) && (
                                <ul className="dian-validacion__alertas">
                                    {validaciones.flatMap((v) => v.alertas.map((a, i) => (
                                        <li key={`${v.codigo}-${i}`}><strong>{v.codigo}:</strong> {a}</li>
                                    )))}
                                </ul>
                            )}
                        </div>
                    )}

                    {Object.entries(exo.formatos).map(([codigo, f]) => (
                        <div key={codigo} className="dian-formato">
                            <div className="dian-formato__head">
                                <div>
                                    <strong>Formato {codigo}</strong> — {f.nombre}
                                    <span className="dian-formato__count">{f.rows.length} registro(s)</span>
                                    {f.sin_identificar > 0 && <span className="dian-formato__count" style={{ background: "rgba(255,75,75,.12)", color: "var(--tertiary-color)" }}>{f.sin_identificar} sin NIT</span>}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn-secondary" onClick={() => exportFormato(codigo)} disabled={!f.rows.length}>
                                        <i className="ri-file-excel-2-line" /> Excel
                                    </button>
                                    <button className="btn-secondary" onClick={() => exportXml(codigo)} disabled={!f.identificados} title={f.identificados ? "Genera el XML oficial DIAN (solo terceros con NIT)" : "No hay terceros identificados con NIT"}>
                                        <i className="ri-code-s-slash-line" /> XML DIAN
                                    </button>
                                </div>
                            </div>
                            {f.rows.length > 0 && (
                                <table className="acc-table">
                                    <thead><tr><th>NIT</th><th>Tercero</th><th style={{ textAlign: "right" }}>Valor</th><th></th></tr></thead>
                                    <tbody>
                                        {f.rows.slice(0, 8).map((r, i) => (
                                            <tr key={i}>
                                                <td>{r.nit || "—"}</td>
                                                <td>{r.tercero}</td>
                                                <td style={{ textAlign: "right" }}>{money(r.valor)}</td>
                                                <td>{r.identificado ? <span className="status-badge status-paid">✓</span> : <span className="status-badge status-rejected" title="Sin NIT en el maestro de terceros">sin NIT</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {f.rows.length > 8 && <p className="acc-sub" style={{ marginTop: 4 }}>… y {f.rows.length - 8} más. Exporta a Excel para ver el detalle completo.</p>}
                        </div>
                    ))}
                    <p className="acc-sub" style={{ marginTop: 12 }}>El XML oficial DIAN incluye solo los terceros con NIT identificado en el maestro de terceros. Los marcados "sin NIT" debes completarlos en Terceros antes de presentar.</p>
                </div>
            )}
        </div>
    );
};

export default DianExogena;
