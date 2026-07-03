import { useCallback, useEffect, useState } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import "../../billing-history/components/StatisticsDashboard.css";
import "../../billing-history/components/ReportsPanel.css";
import { errorToast } from "../../../components/shared/toast/toasts";
import { downloadRowsXlsx } from "../../accounting/import.utils";
import {
    getExecutiveSummary,
    getPlMonthly,
    getCashflowMonthly,
    getProjection,
    getAlerts,
    getCashflowProjection,
    getPendingDocs,
    getDsoDpo,
    type AlertItem,
    type ExecutiveSummary,
    type PlMonthlyRow,
    type CashflowReport,
    type ProjectionReport,
    type CashflowProjReport,
    type PendingReport,
    type DsoDpoReport,
    type Urgencia,
    type DateRange,
} from "../analytics.service";
import { KpiCard, Section, AlertList, SkeletonGrid, HealthBadge, moneyShort as ms } from "./ui";
import ProjectionChart from "./ProjectionChart";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const COLORS = {
    primary: "rgba(96, 153, 172, 0.92)",
    teal: "rgba(90, 159, 180, 0.92)",
    success: "rgba(34, 197, 94, 0.9)",
    warning: "rgba(234, 179, 8, 0.9)",
    danger: "rgba(239, 68, 68, 0.9)",
};
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const money = (n: number) => "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const mLabel = (r: { year: number; month: number }) => `${MONTHS[r.month - 1]} ${String(r.year).slice(2)}`;
const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" as const } } };

interface Props {
    /** "resumen" = resumen ejecutivo, "rentabilidad" = P&L, "tesoreria" = flujo de caja */
    tab: "resumen" | "rentabilidad" | "tesoreria";
    range: DateRange;
}

const FinancialDashboard: React.FC<Props> = ({ tab, range }) => {
    const [loading, setLoading] = useState(true);
    const [exec, setExec] = useState<ExecutiveSummary | null>(null);
    const [pl, setPl] = useState<PlMonthlyRow[]>([]);
    const [cash, setCash] = useState<CashflowReport | null>(null);
    const [proj, setProj] = useState<ProjectionReport | null>(null);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [cashProj, setCashProj] = useState<CashflowProjReport | null>(null);
    const [dso, setDso] = useState<DsoDpoReport | null>(null);
    const [pendCobrar, setPendCobrar] = useState<PendingReport | null>(null);
    const [pendPagar, setPendPagar] = useState<PendingReport | null>(null);
    const [pendTipo, setPendTipo] = useState<"cobrar" | "pagar">("cobrar");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (tab === "resumen") {
                const [e, p, pr, al] = await Promise.all([getExecutiveSummary(range), getPlMonthly(range), getProjection(range), getAlerts(range).then((r) => r.alerts).catch(() => [])]);
                setExec(e);
                setPl(p);
                setProj(pr);
                setAlerts(al);
            } else if (tab === "rentabilidad") {
                setPl(await getPlMonthly(range));
            } else {
                const [c, cp, d, pc, pp] = await Promise.all([
                    getCashflowMonthly(range),
                    getCashflowProjection(),
                    getDsoDpo(range),
                    getPendingDocs("cobrar"),
                    getPendingDocs("pagar"),
                ]);
                setCash(c);
                setCashProj(cp);
                setDso(d);
                setPendCobrar(pc);
                setPendPagar(pp);
            }
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar la analítica");
        } finally {
            setLoading(false);
        }
    }, [tab, range]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) return <SkeletonGrid kpis={8} charts={tab === "resumen" ? 2 : 1} />;

    // ── Resumen ejecutivo (premium) ──
    if (tab === "resumen") {
        const e = exec;
        const sIngresos = pl.map((r) => r.ingresos);
        const sUtilidad = pl.map((r) => r.utilidadNeta);
        const sGastos = pl.map((r) => r.gastoOperativo);
        const sCosto = pl.map((r) => r.costo);
        const plComboData = {
            labels: pl.map(mLabel),
            datasets: [
                { type: "bar" as const, label: "Ingresos", data: sIngresos, backgroundColor: COLORS.success, borderRadius: 4, order: 2 },
                { type: "bar" as const, label: "Costo + gasto", data: pl.map((r) => r.costo + r.gastoOperativo), backgroundColor: COLORS.warning, borderRadius: 4, order: 3 },
                { type: "line" as const, label: "Utilidad neta", data: sUtilidad, borderColor: COLORS.primary, backgroundColor: "rgba(96, 153, 172, 0.12)", tension: 0.3, order: 1 },
            ],
        };

        // Semáforo de alertas (desde el backend; agrega cartera/CxP vencida, IVA, proyección, pérdida).
        const alertItems = alerts.length ? alerts : [{ level: "ok" as const, icon: "ri-checkbox-circle-line", text: "Sin alertas financieras en el período." }];

        return (
            <div>
                <div className="pa-grid">
                    <KpiCard label="Ingresos" value={ms(e?.ingresos ?? 0)} icon="ri-line-chart-line" accent="#22c55e" delta={e?.deltas?.ingresos} spark={sIngresos} />
                    <KpiCard label="Costo de ventas" value={ms(e?.costoVentas ?? 0)} icon="ri-shopping-bag-3-line" accent="#f59e0b" spark={sCosto} />
                    <KpiCard label="Gastos" value={ms(e?.gastos ?? 0)} icon="ri-wallet-3-line" accent="#a855f7" delta={e?.deltas?.gastos} deltaInvert spark={sGastos} />
                    <KpiCard label="Utilidad neta" value={ms(e?.utilidadNeta ?? 0)} icon="ri-funds-line" accent="#6099ac" delta={e?.deltas?.utilidadNeta} hint={`Margen ${e?.margenNeto ?? 0}%`} spark={sUtilidad} negative={(e?.utilidadNeta ?? 0) < 0} />
                    <KpiCard label="Caja y bancos" value={ms(e?.caja ?? 0)} icon="ri-bank-line" accent="#5a9fb4" />
                    <KpiCard label="Por cobrar" value={ms(e?.cxc ?? 0)} icon="ri-arrow-left-down-line" accent="#0ea5e9" />
                    <KpiCard label="Por pagar" value={ms(e?.cxp ?? 0)} icon="ri-arrow-right-up-line" accent="#ef4444" />
                    <KpiCard label="Capital de trabajo" value={ms(e?.capitalTrabajo ?? 0)} icon="ri-scales-3-line" accent="#6366f1" negative={(e?.capitalTrabajo ?? 0) < 0} />
                </div>

                <div className="pa-sections-2">
                    <Section title="Resultado mensual" icon="ri-bar-chart-grouped-line" sub="Ingresos vs costo+gasto vs utilidad neta">
                        <div className="pa-section__chart">
                            {pl.length ? <Bar data={plComboData as never} options={chartOptions} /> : <p className="reports-empty">Sin movimientos contables en el período</p>}
                        </div>
                    </Section>
                    <Section title="Semáforo financiero" icon="ri-alarm-warning-line" sub="Alertas del período">
                        <AlertList items={alertItems} />
                    </Section>
                </div>

                <Section title="Proyección de ingresos" icon="ri-roadmap-line" sub="Próximos 3 meses con banda de confianza ±1σ (basada en el histórico)">
                    {proj && proj.historico.length >= 2 ? <ProjectionChart data={proj} accent="#5a9fb4" /> : <p className="reports-empty">Histórico insuficiente para proyectar</p>}
                </Section>
            </div>
        );
    }

    // ── Rentabilidad ──
    if (tab === "rentabilidad") {
        const margenData = {
            labels: pl.map(mLabel),
            datasets: [
                { type: "bar" as const, label: "Utilidad bruta", data: pl.map((r) => r.utilidadBruta), backgroundColor: COLORS.teal, borderRadius: 4, yAxisID: "y" },
                { type: "line" as const, label: "Margen bruto %", data: pl.map((r) => r.margenBruto), borderColor: COLORS.primary, tension: 0.3, yAxisID: "y1" },
            ],
        };
        const margenOpts = {
            ...chartOptions,
            scales: { y: { position: "left" as const, beginAtZero: true }, y1: { position: "right" as const, grid: { drawOnChartArea: false }, ticks: { callback: (v: number | string) => `${v}%` } } },
        };
        // Totales del rango (suma de la serie mensual).
        const tIng = pl.reduce((s, r) => s + r.ingresos, 0);
        const tCosto = pl.reduce((s, r) => s + r.costo, 0);
        const tGasto = pl.reduce((s, r) => s + r.gastoOperativo, 0);
        const tUtilBruta = tIng - tCosto;
        const tUtilNeta = tUtilBruta - tGasto;
        const mBruto = tIng ? +((tUtilBruta / tIng) * 100).toFixed(1) : 0;
        const mNeto = tIng ? +((tUtilNeta / tIng) * 100).toFixed(1) : 0;
        return (
            <div>
                <div className="pa-grid">
                    <KpiCard label="Utilidad bruta" value={ms(tUtilBruta)} icon="ri-funds-line" accent="#14b8a6" hint={`Margen ${mBruto}%`} spark={pl.map((r) => r.utilidadBruta)} negative={tUtilBruta < 0} />
                    <KpiCard label="Utilidad neta" value={ms(tUtilNeta)} icon="ri-line-chart-line" accent="#3b82f6" hint={`Margen ${mNeto}%`} spark={pl.map((r) => r.utilidadNeta)} negative={tUtilNeta < 0} />
                    <KpiCard label="Ingresos" value={ms(tIng)} icon="ri-arrow-up-circle-line" accent="#22c55e" spark={pl.map((r) => r.ingresos)} />
                    <KpiCard label="Costo de ventas" value={ms(tCosto)} icon="ri-shopping-bag-3-line" accent="#f59e0b" />
                    <KpiCard label="Gastos operativos" value={ms(tGasto)} icon="ri-wallet-3-line" accent="#a855f7" />
                </div>
                <Section title="Utilidad bruta y margen por mes" icon="ri-bar-chart-2-line" sub="Tendencia de rentabilidad">
                    <div className="pa-section__chart">
                        {pl.length ? <Bar data={margenData as never} options={margenOpts as never} /> : <p className="reports-empty">Sin datos en el período</p>}
                    </div>
                </Section>
                {pl.length > 0 && (
                    <Section
                        title="Estado de resultados mensual"
                        icon="ri-file-list-3-line"
                        actions={
                            <button className="reports-chip" onClick={() => downloadRowsXlsx(
                                "estado-resultados-mensual.xlsx",
                                ["Mes", "Ingresos", "Costo", "Utilidad bruta", "Margen bruto %", "Gastos", "Utilidad neta", "Margen neto %"],
                                pl.map((r) => [mLabel(r), String(r.ingresos), String(r.costo), String(r.utilidadBruta), String(r.margenBruto), String(r.gastoOperativo), String(r.utilidadNeta), String(r.margenNeto)]),
                                "P&L",
                            )}><i className="ri-file-excel-2-line" /> Excel</button>
                        }
                    >
                        <div style={{ overflowX: "auto" }}>
                        <table className="pa-table">
                            <thead>
                                <tr>
                                    <th>Mes</th>
                                    <th style={{ textAlign: "right" }}>Ingresos</th>
                                    <th style={{ textAlign: "right" }}>Costo</th>
                                    <th style={{ textAlign: "right" }}>Util. bruta</th>
                                    <th style={{ textAlign: "right" }}>Margen br.</th>
                                    <th style={{ textAlign: "right" }}>Gastos</th>
                                    <th style={{ textAlign: "right" }}>Util. neta</th>
                                    <th style={{ textAlign: "right" }}>Margen neto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pl.map((r) => (
                                    <tr key={r.periodo}>
                                        <td>{mLabel(r)}</td>
                                        <td style={{ textAlign: "right" }}>{money(r.ingresos)}</td>
                                        <td style={{ textAlign: "right" }}>{money(r.costo)}</td>
                                        <td style={{ textAlign: "right" }}>{money(r.utilidadBruta)}</td>
                                        <td style={{ textAlign: "right" }}>{r.margenBruto}%</td>
                                        <td style={{ textAlign: "right" }}>{money(r.gastoOperativo)}</td>
                                        <td style={{ textAlign: "right", fontWeight: 600, color: r.utilidadNeta >= 0 ? undefined : "var(--status-rejected-text,#b91c1c)" }}>{money(r.utilidadNeta)}</td>
                                        <td style={{ textAlign: "right" }}>{r.margenNeto}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </Section>
                )}
            </div>
        );
    }

    // ── Tesorería: flujo histórico + PROYECTADO + ciclo + pendientes ──
    const meses = cash?.meses ?? [];
    const cashData = {
        labels: meses.map(mLabel),
        datasets: [
            { type: "bar" as const, label: "Entradas", data: meses.map((m) => m.entradas), backgroundColor: COLORS.success, borderRadius: 4 },
            { type: "bar" as const, label: "Salidas", data: meses.map((m) => m.salidas), backgroundColor: COLORS.danger, borderRadius: 4 },
            { type: "line" as const, label: "Saldo", data: meses.map((m) => m.saldoFinal), borderColor: COLORS.primary, tension: 0.3 },
        ],
    };
    const cp = cashProj;
    const projData = {
        labels: (cp?.proyeccion ?? []).map(mLabel),
        datasets: [
            { type: "bar" as const, label: "Cobros esperados", data: (cp?.proyeccion ?? []).map((m) => m.entradas), backgroundColor: COLORS.success, borderRadius: 4 },
            { type: "bar" as const, label: "Pagos esperados", data: (cp?.proyeccion ?? []).map((m) => m.salidas), backgroundColor: COLORS.danger, borderRadius: 4 },
            { type: "line" as const, label: "Saldo proyectado", data: (cp?.proyeccion ?? []).map((m) => m.saldoFinal), borderColor: COLORS.primary, backgroundColor: "rgba(96, 153, 172, 0.12)", tension: 0.3, fill: true },
        ],
    };

    const URG: Record<Urgencia, { level: "ok" | "warn" | "bad" | "info"; label: string }> = {
        al_dia: { level: "ok", label: "Al día" },
        por_vencer: { level: "info", label: "Por vencer" },
        vencida: { level: "warn", label: "Vencida" },
        critica: { level: "bad", label: "Crítica" },
    };
    const pend = pendTipo === "cobrar" ? pendCobrar : pendPagar;

    return (
        <div>
            <div className="pa-grid">
                <KpiCard label="Saldo de caja y bancos" value={ms(cp?.cajaActual ?? cash?.saldoFinal ?? 0)} icon="ri-bank-line" accent="#14b8a6" />
                <KpiCard label="Por cobrar" value={ms(cp?.totalPorCobrar ?? 0)} icon="ri-arrow-left-down-line" accent="#22c55e" hint={`Vencido ${ms(cp?.vencidoCobrar ?? 0)}`} />
                <KpiCard label="Por pagar" value={ms(cp?.totalPorPagar ?? 0)} icon="ri-arrow-right-up-line" accent="#ef4444" hint={`Vencido ${ms(cp?.vencidoPagar ?? 0)}`} />
                <KpiCard label="Saldo proyectado" value={ms(cp?.saldoProyectadoFinal ?? 0)} icon="ri-line-chart-line" accent="#3b82f6" negative={(cp?.saldoProyectadoFinal ?? 0) < 0} hint="A 6 meses" />
                <KpiCard label="Días de cartera (DSO)" value={`${dso?.dso ?? 0} d`} icon="ri-time-line" accent="#0ea5e9" />
                <KpiCard label="Días de pago (DPO)" value={`${dso?.dpo ?? 0} d`} icon="ri-timer-line" accent="#a855f7" />
                <KpiCard label="Ciclo de caja" value={`${dso?.cicloCaja ?? 0} d`} icon="ri-loop-left-line" accent="#6366f1" hint="DSO − DPO" />
                <KpiCard label="Entradas históricas (rango)" value={ms(meses.reduce((s, m) => s + m.entradas, 0))} icon="ri-funds-line" accent="#16a34a" />
            </div>

            <Section title="Flujo de caja proyectado" icon="ri-rocket-2-line" sub="Cobros y pagos esperados por su fecha de vencimiento real, y saldo de caja proyectado a 6 meses">
                <div className="pa-section__chart" style={{ height: 300 }}>
                    {cp?.proyeccion.length ? <Bar data={projData as never} options={chartOptions} /> : <p className="reports-empty">Sin documentos pendientes para proyectar</p>}
                </div>
                {(cp?.saldoProyectadoFinal ?? 0) < 0 && (
                    <div style={{ marginTop: 12 }}>
                        <AlertList items={[{ level: "bad", icon: "ri-alarm-warning-line", text: `La proyección indica saldo de caja NEGATIVO (${ms(cp?.saldoProyectadoFinal ?? 0)}) en el horizonte. Revisa cobros y pagos.` }]} />
                    </div>
                )}
            </Section>

            <Section
                title={`Facturas pendientes ${pendTipo === "cobrar" ? "de cobro" : "de pago"}`}
                icon="ri-list-check-2"
                sub="Con semáforo de urgencia por fecha de vencimiento"
                actions={
                    <div className="reports-filters">
                        <button className={`reports-chip ${pendTipo === "cobrar" ? "reports-chip--active" : ""}`} onClick={() => setPendTipo("cobrar")}>Por cobrar</button>
                        <button className={`reports-chip ${pendTipo === "pagar" ? "reports-chip--active" : ""}`} onClick={() => setPendTipo("pagar")}>Por pagar</button>
                    </div>
                }
            >
                {pend && pend.docs.length > 0 ? (
                    <div style={{ overflowX: "auto" }}>
                        <table className="pa-table">
                            <thead>
                                <tr><th>Documento</th><th>{pendTipo === "cobrar" ? "Cliente" : "Proveedor"}</th><th style={{ textAlign: "right" }}>Saldo</th><th>Vencimiento</th><th style={{ textAlign: "right" }}>Días</th><th>Estado</th></tr>
                            </thead>
                            <tbody>
                                {pend.docs.map((d, i) => (
                                    <tr key={d.numero + i}>
                                        <td>{d.numero}</td>
                                        <td>{d.tercero}</td>
                                        <td style={{ textAlign: "right", fontWeight: 600 }}>{money(d.saldo)}</td>
                                        <td>{d.vencimiento}</td>
                                        <td style={{ textAlign: "right", color: d.diasVencido > 0 ? "var(--status-rejected-text,#b91c1c)" : undefined }}>{d.diasVencido > 0 ? `+${d.diasVencido}` : d.diasVencido}</td>
                                        <td><HealthBadge level={URG[d.urgencia].level}>{URG[d.urgencia].label}</HealthBadge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="reports-empty">Sin documentos pendientes {pendTipo === "cobrar" ? "de cobro" : "de pago"}</p>
                )}
            </Section>

            <Section title="Flujo de caja histórico" icon="ri-bar-chart-grouped-line" sub="Entradas, salidas y saldo (movimientos contabilizados del rango)">
                <div className="pa-section__chart">
                    {meses.length ? <Bar data={cashData as never} options={chartOptions} /> : <p className="reports-empty">Sin movimientos de caja en el período</p>}
                </div>
            </Section>
        </div>
    );
};

export default FinancialDashboard;
