import { useCallback, useEffect, useState } from "react";
import { getFinancialStatements, type FinancialStatements as FS, type FinancialLine } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl } from "../../../components/design-system";
import { formatMoney, yearStartIso, todayIso } from "../ledgerFormat";

const Block: React.FC<{ title: string; lines: FinancialLine[]; total: number; totalLabel: string }> = ({
    title,
    lines,
    total,
    totalLabel,
}) => (
    <div className="fs-block">
        <h3>{title}</h3>
        <div className="acc-table-container">
            <table className="acc-table">
                <tbody>
                    {lines.length === 0 ? (
                        <tr>
                            <td colSpan={2} style={{ color: "var(--text-muted)" }}>Sin movimientos</td>
                        </tr>
                    ) : (
                        lines.map((l) => (
                            <tr key={l.grupo}>
                                <td>{l.grupo} — {l.nombre}</td>
                                <td className="ds-num">{formatMoney(l.saldo)}</td>
                            </tr>
                        ))
                    )}
                </tbody>
                <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                        <td>{totalLabel}</td>
                        <td className="ds-num">{formatMoney(total)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
);

const FinancialStatements: React.FC = () => {
    const [desde, setDesde] = useState(yearStartIso());
    const [hasta, setHasta] = useState(todayIso());
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

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="led-section">
            <p className="pm-hint">Balance general y estado de resultados, agrupados por clase y grupo del PUC.</p>

            <div className="led-section__toolbar">
                <FilterField label="Desde" htmlFor="fs-desde" icon="ri-calendar-line">
                    <FieldControl id="fs-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </FilterField>
                <FilterField label="Hasta" htmlFor="fs-hasta" icon="ri-calendar-line">
                    <FieldControl id="fs-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </FilterField>
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
                                {formatMoney(data.balance_general.utilidad_ejercicio)}
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
                                {formatMoney(data.estado_resultados.utilidad)}
                            </strong>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialStatements;
