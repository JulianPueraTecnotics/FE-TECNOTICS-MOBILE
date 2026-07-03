import { useCallback, useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getIntegrity, type IntegrityResponse, type IntegrityCheck } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { formatMoney } from "../ledgerFormat";

/**
 * Salud contable: documentos que deberían tener asiento y no lo tienen (la
 * contabilización automática es "mejor esfuerzo" y puede fallar en silencio),
 * más comprobantes contabilizados descuadrados. Todo en cero = libros íntegros.
 */
const IntegrityPanel: React.FC = () => {
    const [data, setData] = useState<IntegrityResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [abierto, setAbierto] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getIntegrity());
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al verificar la integridad");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) return <p className="reports-empty">Verificando la integridad de los libros…</p>;
    if (!data) return <p className="reports-empty">No se pudo cargar la verificación.</p>;

    const fecha = (s?: string) => (s ? new Date(s).toLocaleDateString("es-CO") : "—");

    const renderCheck = (c: IntegrityCheck) => {
        const ok = c.sin_asiento === 0;
        const expandido = abierto === c.key;
        return (
            <div key={c.key} className="purchases-table-container ds-table-container" style={{ marginBottom: 12, padding: "0.9rem 1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <i
                            className={ok ? "ri-checkbox-circle-fill" : "ri-error-warning-fill"}
                            style={{ fontSize: "1.3rem", color: ok ? "var(--accent-teal)" : "#dc2626" }}
                            aria-hidden
                        />
                        <div>
                            <strong>{c.label}</strong>
                            <div style={{ fontSize: "0.85rem", color: "var(--tertiary-color)" }}>
                                {ok
                                    ? `Sin pendientes${c.total_docs != null ? ` (${c.total_docs} documento(s) verificados)` : ""}`
                                    : `${c.sin_asiento} documento(s) sin asiento${c.total_docs != null ? ` de ${c.total_docs}` : ""}`}
                            </div>
                        </div>
                    </div>
                    {!ok && (
                        <button type="button" className="btn-secondary" onClick={() => setAbierto(expandido ? null : c.key)}>
                            {expandido ? "Ocultar" : "Ver detalle"}
                        </button>
                    )}
                </div>
                {!ok && expandido && (
                    <table className="purchases-table ds-table" style={{ marginTop: 10 }}>
                        <thead>
                            <tr><th>Documento</th><th>Tercero</th><th>Fecha</th><th style={{ textAlign: "right" }}>Valor</th></tr>
                        </thead>
                        <tbody>
                            {c.ejemplos.map((e, i) => (
                                <tr key={`${c.key}-${i}`}>
                                    <td>{e.numero || "—"}</td>
                                    <td>{e.tercero || "—"}</td>
                                    <td>{fecha(e.fecha)}</td>
                                    <td style={{ textAlign: "right" }}>{formatMoney(e.total ?? 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    };

    return (
        <div>
            <div className="purchases-summary" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {data.problemas === 0 ? (
                    <span style={{ color: "var(--accent-teal)", fontWeight: 600 }}>
                        <i className="ri-shield-check-fill" /> Libros íntegros: todos los documentos tienen su asiento y todos los comprobantes cuadran.
                    </span>
                ) : (
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>
                        <i className="ri-alarm-warning-fill" /> {data.problemas} problema(s) de integridad — los reportes financieros pueden estar incompletos.
                    </span>
                )}
                <button type="button" className="btn-secondary" onClick={load}>
                    <i className="ri-refresh-line" /> Verificar de nuevo
                </button>
            </div>
            {data.checks.map(renderCheck)}
            <p style={{ fontSize: "0.82rem", color: "var(--tertiary-color)", marginTop: 6 }}>
                Un documento sin asiento suele deberse a cuentas por defecto sin configurar o a un período cerrado en el momento de
                emitirlo. Corrige la causa y vuelve a guardar/recontabilizar el documento desde su módulo.
            </p>
        </div>
    );
};

export default IntegrityPanel;
