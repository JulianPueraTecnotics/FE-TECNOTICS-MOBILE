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
import { Bar, Line, Doughnut } from "react-chartjs-2";
import "./StatisticsDashboard.css";
import "./ReportsPanel.css";
import { KpiCard, SkeletonGrid } from "../../analytics/components/ui";
import { errorToast } from "../../../components/shared/toast/toasts";
import {
    getCarteraAging,
    getCxpAging,
    getTopClientes,
    getTopProveedores,
    getVentasComprasGastos,
    getRecaudoFormaPago,
    getEmbudoCotizaciones,
    type AgingReport,
    type TopParty,
    type MonthlyComparison,
    type RecaudoReport,
    type QuoteFunnel,
    type DateRange,
} from "../../../services/business-reports.service";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const COLORS = {
    primary: "rgba(59, 130, 246, 0.9)",
    teal: "rgba(20, 184, 166, 0.9)",
    success: "rgba(34, 197, 94, 0.9)",
    warning: "rgba(234, 179, 8, 0.9)",
    danger: "rgba(239, 68, 68, 0.9)",
    muted: "rgba(148, 163, 184, 0.8)",
    palette: ["rgba(34, 197, 94, 0.9)", "rgba(234, 179, 8, 0.9)", "rgba(245, 158, 11, 0.9)", "rgba(239, 68, 68, 0.9)", "rgba(190, 18, 60, 0.9)"],
};
const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const money = (n: number) => "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const moneyShort = (v: number) => (v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${v}`);

const METHOD_LABELS: Record<string, string> = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    consignacion: "Consignación",
    tarjeta: "Tarjeta",
    cheque: "Cheque",
    otro: "Otro",
};
const QUOTE_LABELS: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviada",
    accepted: "Aceptada",
    rejected: "Rechazada",
    expired: "Expirada",
    invoiced: "Facturada",
};

const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" as const } } };
const barOptions = { ...chartOptions, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

/** Devuelve [from, to] en formato YYYY-MM-DD para un preset. */
function presetRange(preset: string): DateRange {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    switch (preset) {
        case "mes":
            return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
        case "trimestre": {
            const qStart = Math.floor(m / 3) * 3;
            return { from: iso(new Date(y, qStart, 1)), to: iso(new Date(y, qStart + 3, 0)) };
        }
        case "anio":
            return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
        default:
            return {};
    }
}

const ReportsPanel: React.FC = () => {
    const [preset, setPreset] = useState("anio");
    const [range, setRange] = useState<DateRange>(presetRange("anio"));
    const [loading, setLoading] = useState(true);

    const [cartera, setCartera] = useState<AgingReport | null>(null);
    const [cxp, setCxp] = useState<AgingReport | null>(null);
    const [topCli, setTopCli] = useState<TopParty[]>([]);
    const [topProv, setTopProv] = useState<TopParty[]>([]);
    const [comparativo, setComparativo] = useState<MonthlyComparison[]>([]);
    const [recaudo, setRecaudo] = useState<RecaudoReport | null>(null);
    const [embudo, setEmbudo] = useState<QuoteFunnel | null>(null);

    const applyPreset = (p: string) => {
        setPreset(p);
        if (p !== "custom") setRange(presetRange(p));
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [c, cp, tc, tp, comp, rec, emb] = await Promise.all([
                getCarteraAging(),
                getCxpAging(),
                getTopClientes(range),
                getTopProveedores(range),
                getVentasComprasGastos(range),
                getRecaudoFormaPago(range),
                getEmbudoCotizaciones(range),
            ]);
            setCartera(c);
            setCxp(cp);
            setTopCli(tc);
            setTopProv(tp);
            setComparativo(comp);
            setRecaudo(rec);
            setEmbudo(emb);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar reportes");
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => {
        load();
    }, [load]);

    const agingBar = (rep: AgingReport | null) => ({
        labels: (rep?.buckets ?? []).map((b) => b.label),
        datasets: [{ label: "Saldo", data: (rep?.buckets ?? []).map((b) => b.total), backgroundColor: COLORS.palette, borderRadius: 4 }],
    });

    const comparativoData = {
        labels: comparativo.map((r) => `${MONTH_NAMES[r.month - 1]} ${String(r.year).slice(2)}`),
        datasets: [
            { label: "Ventas", data: comparativo.map((r) => r.ventas), borderColor: COLORS.success, backgroundColor: "rgba(34,197,94,0.12)", fill: true, tension: 0.3 },
            { label: "Compras", data: comparativo.map((r) => r.compras), borderColor: COLORS.primary, backgroundColor: "rgba(59,130,246,0.1)", fill: true, tension: 0.3 },
            { label: "Gastos", data: comparativo.map((r) => r.gastos), borderColor: COLORS.warning, backgroundColor: "rgba(234,179,8,0.1)", fill: true, tension: 0.3 },
        ],
    };

    const recaudoData = {
        labels: (recaudo?.rows ?? []).map((r) => METHOD_LABELS[r.method] ?? r.method),
        datasets: [{ data: (recaudo?.rows ?? []).map((r) => r.total), backgroundColor: COLORS.palette, borderWidth: 0 }],
    };

    const embudoData = {
        labels: (embudo?.porEstado ?? []).map((r) => QUOTE_LABELS[r.estado] ?? r.estado),
        datasets: [{ label: "Cotizaciones", data: (embudo?.porEstado ?? []).map((r) => r.count), backgroundColor: COLORS.teal, borderRadius: 4 }],
    };

    return (
        <div className="stats-dashboard">
            <div className="stats-dashboard__header reports-header">
                <div>
                    <h2 className="stats-dashboard__title">Reportes</h2>
                    <span className="stats-dashboard__subtitle">Cartera, ventas, compras, recaudo y conversión</span>
                </div>
                <div className="reports-filters">
                    {[
                        { k: "mes", l: "Mes" },
                        { k: "trimestre", l: "Trimestre" },
                        { k: "anio", l: "Año" },
                        { k: "custom", l: "Personalizado" },
                    ].map((p) => (
                        <button key={p.k} className={`reports-chip ${preset === p.k ? "reports-chip--active" : ""}`} onClick={() => applyPreset(p.k)}>
                            {p.l}
                        </button>
                    ))}
                    {preset === "custom" && (
                        <span className="reports-custom-range">
                            <input type="date" value={range.from ?? ""} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                            <span>—</span>
                            <input type="date" value={range.to ?? ""} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                        </span>
                    )}
                </div>
            </div>

            {loading ? (
                <SkeletonGrid kpis={4} charts={2} />
            ) : (
                <>
                    {/* KPIs de cartera y CxP */}
                    <div className="pa-grid">
                        <KpiCard label="Por cobrar (cartera)" value={moneyShort(cartera?.total ?? 0)} icon="ri-arrow-left-down-line" accent="#22c55e" hint={`Vencido ${moneyShort(cartera?.totalVencido ?? 0)}`} />
                        <KpiCard label="Por pagar (proveedores)" value={moneyShort(cxp?.total ?? 0)} icon="ri-arrow-right-up-line" accent="#ef4444" hint={`Vencido ${moneyShort(cxp?.totalVencido ?? 0)}`} />
                        <KpiCard label="Recaudado (período)" value={moneyShort(recaudo?.total ?? 0)} icon="ri-hand-coin-line" accent="#14b8a6" />
                        <KpiCard label="Cotizaciones facturadas" value={String(embudo?.facturadas ?? 0)} icon="ri-draft-line" accent="#3b82f6" hint={`Conversión ${embudo?.tasaConversion ?? 0}%`} />
                    </div>

                    <div className="stats-dashboard__charts">
                        {/* Comparativo ventas/compras/gastos */}
                        <div className="stats-chart-card stats-chart-card--wide">
                            <h3 className="stats-chart-card__title">Ventas vs compras vs gastos (por mes)</h3>
                            <div className="stats-chart-card__chart">
                                {comparativo.length ? <Line data={comparativoData} options={chartOptions} /> : <p className="reports-empty">Sin datos en el período</p>}
                            </div>
                        </div>

                        {/* Aging cartera */}
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Cartera por antigüedad</h3>
                            <div className="stats-chart-card__chart">
                                {cartera?.total ? <Bar data={agingBar(cartera)} options={barOptions} /> : <p className="reports-empty">Sin cartera pendiente</p>}
                            </div>
                        </div>

                        {/* Aging CxP */}
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Cuentas por pagar por antigüedad</h3>
                            <div className="stats-chart-card__chart">
                                {cxp?.total ? <Bar data={agingBar(cxp)} options={barOptions} /> : <p className="reports-empty">Sin cuentas por pagar</p>}
                            </div>
                        </div>

                        {/* Recaudo por forma de pago */}
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Recaudo por forma de pago</h3>
                            <div className="stats-chart-card__chart stats-chart-card__chart--doughnut">
                                {recaudo?.total ? <Doughnut data={recaudoData} options={chartOptions} /> : <p className="reports-empty">Sin recaudos en el período</p>}
                            </div>
                        </div>

                        {/* Embudo cotizaciones */}
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Embudo de cotizaciones</h3>
                            <div className="stats-chart-card__chart">
                                {embudo?.porEstado.length ? <Bar data={embudoData} options={barOptions} /> : <p className="reports-empty">Sin cotizaciones en el período</p>}
                            </div>
                        </div>
                    </div>

                    {/* Tabla top clientes (Pareto) */}
                    {topCli.length > 0 && (
                        <div className="reports-table-card">
                            <h3 className="stats-chart-card__title">Top clientes por facturación</h3>
                            <table className="reports-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Cliente</th>
                                        <th>NIT/CC</th>
                                        <th style={{ textAlign: "right" }}>Facturas</th>
                                        <th style={{ textAlign: "right" }}>Total</th>
                                        <th style={{ textAlign: "right" }}>%</th>
                                        <th style={{ textAlign: "right" }}>Acum.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topCli.map((c, i) => (
                                        <tr key={c.doc + i}>
                                            <td>{i + 1}</td>
                                            <td>{c.nombre}</td>
                                            <td>{c.doc}</td>
                                            <td style={{ textAlign: "right" }}>{c.count}</td>
                                            <td style={{ textAlign: "right" }}>{money(c.total)}</td>
                                            <td style={{ textAlign: "right" }}>{c.pct}%</td>
                                            <td style={{ textAlign: "right" }}>{c.acumPct}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Tabla top proveedores */}
                    {topProv.length > 0 && (
                        <div className="reports-table-card">
                            <h3 className="stats-chart-card__title">Top proveedores por compra/gasto</h3>
                            <table className="reports-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Proveedor</th>
                                        <th>NIT</th>
                                        <th style={{ textAlign: "right" }}>Docs</th>
                                        <th style={{ textAlign: "right" }}>Total</th>
                                        <th style={{ textAlign: "right" }}>%</th>
                                        <th style={{ textAlign: "right" }}>Acum.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topProv.map((c, i) => (
                                        <tr key={c.doc + i}>
                                            <td>{i + 1}</td>
                                            <td>{c.nombre}</td>
                                            <td>{c.doc}</td>
                                            <td style={{ textAlign: "right" }}>{c.count}</td>
                                            <td style={{ textAlign: "right" }}>{money(c.total)}</td>
                                            <td style={{ textAlign: "right" }}>{c.pct}%</td>
                                            <td style={{ textAlign: "right" }}>{c.acumPct}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Detalle cartera por cliente */}
                    {cartera && cartera.rows.length > 0 && (
                        <div className="reports-table-card">
                            <h3 className="stats-chart-card__title">Cartera por cliente y antigüedad</h3>
                            <table className="reports-table">
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>NIT/CC</th>
                                        <th style={{ textAlign: "right" }}>Corriente</th>
                                        <th style={{ textAlign: "right" }}>1–30</th>
                                        <th style={{ textAlign: "right" }}>31–60</th>
                                        <th style={{ textAlign: "right" }}>61–90</th>
                                        <th style={{ textAlign: "right" }}>+90</th>
                                        <th style={{ textAlign: "right" }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cartera.rows.map((r, i) => (
                                        <tr key={r.doc + i}>
                                            <td>{r.nombre}</td>
                                            <td>{r.doc}</td>
                                            <td style={{ textAlign: "right" }}>{money(r.corriente)}</td>
                                            <td style={{ textAlign: "right" }}>{money(r.d1_30)}</td>
                                            <td style={{ textAlign: "right" }}>{money(r.d31_60)}</td>
                                            <td style={{ textAlign: "right" }}>{money(r.d61_90)}</td>
                                            <td style={{ textAlign: "right", color: r.d90_plus > 0 ? "var(--status-rejected-text, #b91c1c)" : undefined }}>{money(r.d90_plus)}</td>
                                            <td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ReportsPanel;
