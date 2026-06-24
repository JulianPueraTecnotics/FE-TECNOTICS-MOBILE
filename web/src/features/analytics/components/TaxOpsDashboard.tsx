import { useCallback, useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import "../../billing-history/components/StatisticsDashboard.css";
import "../../billing-history/components/ReportsPanel.css";
import { errorToast } from "../../../components/shared/toast/toasts";
import { downloadRowsXlsx } from "../../accounting/import.utils";
import { KpiCard, Section, SkeletonGrid, HealthBadge, moneyShort as ms } from "./ui";
import {
    getIva,
    getRetenciones,
    getTopProductos,
    getPayroll,
    getAssets,
    getScoring,
    type IvaReport,
    type RetencionesReport,
    type TopProducto,
    type PayrollReport,
    type AssetsReport,
    type ScoringReport,
    type DateRange,
} from "../analytics.service";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const COLORS = { primary: "rgba(59,130,246,0.9)", teal: "rgba(20,184,166,0.9)", success: "rgba(34,197,94,0.9)", warning: "rgba(234,179,8,0.9)", danger: "rgba(239,68,68,0.9)", palette: ["rgba(34,197,94,0.9)", "rgba(59,130,246,0.9)", "rgba(234,179,8,0.9)", "rgba(168,85,247,0.9)", "rgba(20,184,166,0.9)", "rgba(239,68,68,0.9)"] };
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const money = (n: number) => "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const pLabel = (p: string) => { const [y, m] = p.split("-"); return `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`; };
const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" as const } } };
const barOpts = { ...opts, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

interface Props {
    tab: "tributario" | "nomina" | "activos" | "scoring";
    range: DateRange;
}

const TaxOpsDashboard: React.FC<Props> = ({ tab, range }) => {
    const [loading, setLoading] = useState(true);
    const [iva, setIva] = useState<IvaReport | null>(null);
    const [ret, setRet] = useState<RetencionesReport | null>(null);
    const [productos, setProductos] = useState<TopProducto[]>([]);
    const [payroll, setPayroll] = useState<PayrollReport | null>(null);
    const [assets, setAssets] = useState<AssetsReport | null>(null);
    const [scoring, setScoring] = useState<ScoringReport | null>(null);
    const [scoreTipo, setScoreTipo] = useState<"cliente" | "proveedor">("cliente");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (tab === "tributario") {
                const [i, r] = await Promise.all([getIva(range), getRetenciones(range)]);
                setIva(i);
                setRet(r);
                setProductos(await getTopProductos(range).catch(() => []));
            } else if (tab === "nomina") {
                setPayroll(await getPayroll(range));
            } else if (tab === "activos") {
                setAssets(await getAssets());
            } else {
                setScoring(await getScoring(range, scoreTipo));
            }
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar la analítica");
        } finally {
            setLoading(false);
        }
    }, [tab, range, scoreTipo]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <SkeletonGrid kpis={tab === "scoring" ? 3 : 4} charts={tab === "activos" ? 1 : 2} />;

    // ── Tributario ──
    if (tab === "tributario") {
        const ivaData = {
            labels: (iva?.porPeriodo ?? []).map((p) => pLabel(p.periodo)),
            datasets: [
                { label: "IVA generado", data: (iva?.porPeriodo ?? []).map((p) => p.generado), backgroundColor: COLORS.success, borderRadius: 4 },
                { label: "IVA descontable", data: (iva?.porPeriodo ?? []).map((p) => p.descontable), backgroundColor: COLORS.primary, borderRadius: 4 },
            ],
        };
        const retData = {
            labels: (ret?.practicadas ?? []).map((r) => r.nombre),
            datasets: [{ data: (ret?.practicadas ?? []).map((r) => r.valor), backgroundColor: COLORS.palette, borderWidth: 0 }],
        };
        return (
            <div>
                <div className="pa-grid">
                    <KpiCard label="IVA generado" value={ms(iva?.generado ?? 0)} icon="ri-arrow-up-circle-line" accent="#22c55e" />
                    <KpiCard label="IVA descontable" value={ms(iva?.descontable ?? 0)} icon="ri-arrow-down-circle-line" accent="#3b82f6" />
                    <KpiCard label="Saldo de IVA" value={ms(Math.abs(iva?.saldo ?? 0))} icon="ri-government-line" accent={iva?.signo === "favor" ? "#22c55e" : "#ef4444"} hint={iva?.signo === "favor" ? "A favor" : "A pagar"} />
                    <KpiCard label="Retenciones practicadas" value={ms(ret?.totalPracticadas ?? 0)} icon="ri-scissors-cut-line" accent="#a855f7" />
                    <KpiCard label="Retenciones sufridas" value={ms(ret?.totalSufridas ?? 0)} icon="ri-inbox-archive-line" accent="#14b8a6" />
                </div>
                <div className="pa-sections-2">
                    <Section title="IVA generado vs descontable" icon="ri-bar-chart-2-line" sub="Por período">
                        <div className="pa-section__chart">{iva?.porPeriodo.length ? <Bar data={ivaData} options={opts} /> : <p className="reports-empty">Sin movimientos de IVA</p>}</div>
                    </Section>
                    <Section title="Retenciones practicadas por tipo" icon="ri-pie-chart-line">
                        <div className="pa-section__chart">{ret?.practicadas.length ? <Doughnut data={retData} options={opts} /> : <p className="reports-empty">Sin retenciones</p>}</div>
                    </Section>
                </div>
                {ret && ret.practicadas.length > 0 && (
                    <div className="reports-table-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <h3 className="stats-chart-card__title">Detalle de retenciones practicadas</h3>
                            <button className="reports-chip" onClick={() => downloadRowsXlsx(
                                "retenciones-practicadas.xlsx",
                                ["Cuenta", "Nombre", "Tipo", "Base", "Valor"],
                                ret.practicadas.map((r) => [r.cuenta, r.nombre, r.tipo, String(r.base), String(r.valor)]),
                                "Retenciones",
                            )}><i className="ri-file-excel-2-line" /> Excel</button>
                        </div>
                        <table className="reports-table">
                            <thead><tr><th>Cuenta</th><th>Tipo</th><th style={{ textAlign: "right" }}>Base</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead>
                            <tbody>
                                {ret.practicadas.map((r) => (
                                    <tr key={r.cuenta}><td>{r.cuenta} {r.nombre !== r.cuenta ? `· ${r.nombre}` : ""}</td><td>{r.tipo}</td><td style={{ textAlign: "right" }}>{money(r.base)}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.valor)}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {productos.length > 0 && (
                    <div className="reports-table-card">
                        <h3 className="stats-chart-card__title">Top productos vendidos</h3>
                        <table className="reports-table">
                            <thead><tr><th>#</th><th>Producto</th><th style={{ textAlign: "right" }}>Cantidad</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>%</th></tr></thead>
                            <tbody>
                                {productos.map((p, i) => (
                                    <tr key={p.nombre + i}><td>{i + 1}</td><td>{p.nombre}</td><td style={{ textAlign: "right" }}>{p.cantidad}</td><td style={{ textAlign: "right" }}>{money(p.total)}</td><td style={{ textAlign: "right" }}>{p.pct}%</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    // ── Nómina ──
    if (tab === "nomina") {
        const costoData = {
            labels: (payroll?.porPeriodo ?? []).map((p) => pLabel(p.periodo)),
            datasets: [{ label: "Costo laboral", data: (payroll?.porPeriodo ?? []).map((p) => p.costo), backgroundColor: COLORS.teal, borderRadius: 4 }],
        };
        const compData = {
            labels: (payroll?.composicion ?? []).map((c) => c.nombre),
            datasets: [{ data: (payroll?.composicion ?? []).map((c) => c.valor), backgroundColor: COLORS.palette, borderWidth: 0 }],
        };
        return (
            <div>
                <div className="pa-grid">
                    <KpiCard label="Costo laboral (período)" value={ms(payroll?.costoLaboral ?? 0)} icon="ri-team-line" accent="#14b8a6" spark={(payroll?.porPeriodo ?? []).map((p) => p.costo)} />
                    <KpiCard label="Empleados activos" value={String(payroll?.headcount ?? 0)} icon="ri-user-line" accent="#3b82f6" />
                    <KpiCard label="Costo promedio/empleado" value={ms(payroll?.costoPromedio ?? 0)} icon="ri-user-star-line" accent="#a855f7" />
                </div>
                <div className="pa-sections-2">
                    <Section title="Costo laboral por mes" icon="ri-bar-chart-line">
                        <div className="pa-section__chart">{payroll?.porPeriodo.length ? <Bar data={costoData} options={barOpts} /> : <p className="reports-empty">Sin nómina contabilizada en el período</p>}</div>
                    </Section>
                    <Section title="Composición del costo laboral" icon="ri-pie-chart-line">
                        <div className="pa-section__chart">{payroll?.composicion.length ? <Doughnut data={compData} options={opts} /> : <p className="reports-empty">Sin datos</p>}</div>
                    </Section>
                </div>
            </div>
        );
    }

    // ── Scoring de terceros (semáforo estilo Causaciones, desde el ledger) ──
    if (tab === "scoring") {
        const r = scoring?.resumen;
        const badge = (s: string) => (s === "eficiente" ? <HealthBadge level="ok">Eficiente</HealthBadge> : s === "riesgo" ? <HealthBadge level="bad">En riesgo</HealthBadge> : <HealthBadge level="warn">Normal</HealthBadge>);
        return (
            <div>
                <div className="pa-grid">
                    <KpiCard label="Eficientes" value={String(r?.eficientes ?? 0)} icon="ri-checkbox-circle-line" accent="#22c55e" hint="≥90% pagado" />
                    <KpiCard label="Normales" value={String(r?.normales ?? 0)} icon="ri-information-line" accent="#f59e0b" />
                    <KpiCard label="En riesgo" value={String(r?.riesgo ?? 0)} icon="ri-error-warning-line" accent="#ef4444" hint="<60% o saldo alto" />
                </div>
                <Section
                    title={`Scoring de ${scoreTipo === "cliente" ? "clientes" : "proveedores"}`}
                    icon="ri-trophy-line"
                    sub="Comportamiento de pago en el período (desde la contabilidad)"
                    actions={
                        <div className="reports-filters">
                            <button className={`reports-chip ${scoreTipo === "cliente" ? "reports-chip--active" : ""}`} onClick={() => setScoreTipo("cliente")}>Clientes</button>
                            <button className={`reports-chip ${scoreTipo === "proveedor" ? "reports-chip--active" : ""}`} onClick={() => setScoreTipo("proveedor")}>Proveedores</button>
                        </div>
                    }
                >
                    {scoring && scoring.terceros.length > 0 ? (
                        <div style={{ overflowX: "auto" }}>
                            <table className="pa-table">
                                <thead>
                                    <tr><th>#</th><th>{scoreTipo === "cliente" ? "Cliente" : "Proveedor"}</th><th>NIT</th><th style={{ textAlign: "right" }}>Facturado</th><th style={{ textAlign: "right" }}>Pagado</th><th style={{ textAlign: "right" }}>Saldo</th><th style={{ textAlign: "right" }}>Ejecución</th><th>Score</th></tr>
                                </thead>
                                <tbody>
                                    {scoring.terceros.map((t, i) => (
                                        <tr key={t.doc + i}>
                                            <td>{i + 1}</td>
                                            <td>{t.nombre}</td>
                                            <td>{t.doc}</td>
                                            <td style={{ textAlign: "right" }}>{money(t.facturado)}</td>
                                            <td style={{ textAlign: "right" }}>{money(t.pagado)}</td>
                                            <td style={{ textAlign: "right", color: t.saldo > 0 ? "var(--status-rejected-text,#b91c1c)" : undefined }}>{money(t.saldo)}</td>
                                            <td style={{ textAlign: "right" }}>{t.ejecucion}%</td>
                                            <td>{badge(t.score)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="reports-empty">Sin movimientos de {scoreTipo === "cliente" ? "clientes" : "proveedores"} en el período</p>
                    )}
                </Section>
            </div>
        );
    }

    // ── Activos ──
    const catData = {
        labels: (assets?.porCategoria ?? []).map((c) => c.categoria),
        datasets: [{ data: (assets?.porCategoria ?? []).map((c) => c.neto), backgroundColor: COLORS.palette, borderWidth: 0 }],
    };
    return (
        <div>
            <div className="pa-grid">
                <KpiCard label="Valor en libros" value={ms(assets?.valorEnLibros ?? 0)} icon="ri-computer-line" accent="#14b8a6" />
                <KpiCard label="Costo histórico" value={ms(assets?.costoHistorico ?? 0)} icon="ri-price-tag-3-line" accent="#3b82f6" />
                <KpiCard label="Depreciación acumulada" value={ms(assets?.depreciacionAcum ?? 0)} icon="ri-arrow-down-line" accent="#f59e0b" />
                <KpiCard label="Activos en uso" value={String(assets?.activosCount ?? 0)} icon="ri-stack-line" accent="#a855f7" />
            </div>
            <Section title="Valor neto por categoría" icon="ri-pie-chart-line">
                <div className="pa-section__chart" style={{ maxWidth: 420, margin: "0 auto" }}>{assets?.porCategoria.length ? <Doughnut data={catData} options={opts} /> : <p className="reports-empty">Sin activos registrados</p>}</div>
            </Section>
            {assets && assets.porCategoria.length > 0 && (
                <div className="reports-table-card">
                    <h3 className="stats-chart-card__title">Activos por categoría</h3>
                    <table className="reports-table">
                        <thead><tr><th>Categoría</th><th style={{ textAlign: "right" }}>Cantidad</th><th style={{ textAlign: "right" }}>Costo</th><th style={{ textAlign: "right" }}>Dep. acum.</th><th style={{ textAlign: "right" }}>Valor neto</th></tr></thead>
                        <tbody>
                            {assets.porCategoria.map((c) => (
                                <tr key={c.categoria}><td>{c.categoria}</td><td style={{ textAlign: "right" }}>{c.count}</td><td style={{ textAlign: "right" }}>{money(c.costo)}</td><td style={{ textAlign: "right" }}>{money(c.depAcum)}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(c.neto)}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default TaxOpsDashboard;
