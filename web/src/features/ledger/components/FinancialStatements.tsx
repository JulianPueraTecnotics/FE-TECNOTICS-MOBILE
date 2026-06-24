import { useCallback, useEffect, useState } from "react";
import { getFinancialStatements, type FinancialStatements as FS, type FinancialLine } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const yStart = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const Block: React.FC<{ title: string; lines: FinancialLine[]; total: number; totalLabel: string }> = ({ title, lines, total, totalLabel }) => (
    <div className="fs-block">
        <h3>{title}</h3>
        <table className="acc-table">
            <tbody>
                {lines.length === 0 ? (
                    <tr><td colSpan={2} style={{ color: "var(--text-muted)" }}>Sin movimientos</td></tr>
                ) : (
                    lines.map((l) => (
                        <tr key={l.grupo}>
                            <td>{l.grupo} — {l.nombre}</td>
                            <td style={{ textAlign: "right" }}>{money(l.saldo)}</td>
                        </tr>
                    ))
                )}
            </tbody>
            <tfoot>
                <tr style={{ fontWeight: 700 }}><td>{totalLabel}</td><td style={{ textAlign: "right" }}>{money(total)}</td></tr>
            </tfoot>
        </table>
    </div>
);

const FinancialStatements: React.FC = () => {
    const [desde, setDesde] = useState(yStart());
    const [hasta, setHasta] = useState(today());
    const [data, setData] = useState<FS | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getFinancialStatements(desde, hasta));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [desde, hasta]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Estados financieros</h2>
                    <p className="acc-sub">Balance general y estado de resultados, agrupados por clase y grupo del PUC.</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
                    <div className="acc-field"><label>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : !data ? null : (
                <div className="fs-grid">
                    <div className="fs-col">
                        <h2 className="fs-title">Estado de situación financiera (Balance General)</h2>
                        <Block title="Activos" lines={data.balance_general.activos} total={data.balance_general.total_activos} totalLabel="Total activos" />
                        <Block title="Pasivos" lines={data.balance_general.pasivos} total={data.balance_general.total_pasivos} totalLabel="Total pasivos" />
                        <Block title="Patrimonio" lines={data.balance_general.patrimonio} total={data.balance_general.total_patrimonio} totalLabel="Total patrimonio" />
                        <div className="fs-result">
                            <span>Resultado del ejercicio</span>
                            <strong style={{ color: data.balance_general.utilidad_ejercicio >= 0 ? "var(--accent-teal)" : "var(--tertiary-color)" }}>
                                {money(data.balance_general.utilidad_ejercicio)}
                            </strong>
                        </div>
                    </div>
                    <div className="fs-col">
                        <h2 className="fs-title">Estado de resultados (P&G)</h2>
                        <Block title="Ingresos" lines={data.estado_resultados.ingresos} total={data.estado_resultados.total_ingresos} totalLabel="Total ingresos" />
                        <Block title="Gastos y costos" lines={data.estado_resultados.gastos} total={data.estado_resultados.total_gastos} totalLabel="Total gastos y costos" />
                        <div className="fs-result">
                            <span>{data.estado_resultados.utilidad >= 0 ? "Utilidad" : "Pérdida"} del ejercicio</span>
                            <strong style={{ color: data.estado_resultados.utilidad >= 0 ? "var(--accent-teal)" : "var(--tertiary-color)" }}>
                                {money(data.estado_resultados.utilidad)}
                            </strong>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialStatements;
