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
import { Doughnut, Bar, Line } from "react-chartjs-2";
import type { CompanyStatisticsData } from "../../../services/company-statistics.service";
import { KpiCard } from "../../analytics/components/ui";
import "./StatisticsDashboard.css";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const COLORS = {
    primary: "rgba(59, 130, 246, 0.9)",
    teal: "rgba(20, 184, 166, 0.9)",
    success: "rgba(34, 197, 94, 0.9)",
    warning: "rgba(234, 179, 8, 0.9)",
    danger: "rgba(239, 68, 68, 0.9)",
    muted: "rgba(148, 163, 184, 0.8)",
    palette: [
        "rgba(34, 197, 94, 0.9)",
        "rgba(234, 179, 8, 0.9)",
        "rgba(239, 68, 68, 0.9)",
        "rgba(59, 130, 246, 0.9)",
        "rgba(168, 85, 247, 0.9)",
        "rgba(236, 72, 153, 0.9)",
    ],
};

const ESTADO_LABELS: Record<string, string> = {
    APPROVED: "Aprobadas",
    PENDING: "Pendientes",
    REJECTED: "Rechazadas",
    SENT: "Enviadas",
    "N/A": "Sin estado",
};

/** Color fijo por estado para que el color sea consistente entre gráficos. */
const ESTADO_COLOR: Record<string, string> = {
    APPROVED: COLORS.success,
    PENDING: COLORS.warning,
    REJECTED: COLORS.danger,
    SENT: COLORS.primary,
    "N/A": COLORS.muted,
};

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatMoney(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toLocaleString("es-CO")}`;
}

/** Etiqueta "Mmm AAAA" para un punto {year, month}. */
const mesLabel = (m: { year: number; month: number }) => `${MONTH_NAMES[m.month - 1]} ${m.year}`;

interface StatisticsDashboardProps {
    data: CompanyStatisticsData | null;
    loading?: boolean;
}

const defaultData: CompanyStatisticsData = {
    facturas: {
        total: 0,
        borradores: 0,
        aprobadas: 0,
        pendientes: 0,
        rechazadas: 0,
        enviadas: 0,
        porEstado: [],
        porTipoDocumento: [],
        porMes: [],
        porPrefijo: [],
        porMoneda: [],
        totalFacturado: 0,
        totalNotasCredito: 0,
        totalValorBruto: 0,
    },
    nomina: { total: 0, borradores: 0, aprobadas: 0, empleados: 0, totalComprobante: 0, porEstado: [], porMes: [] },
    clientes: { total: 0, porTipoDocumento: [], porMes: [] },
    items: { total: 0, productos: 0, servicios: 0, porTipo: [] },
    logger: { totalRegistros: 0 },
};

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom" as const } },
};

const barOptions = {
    ...chartOptions,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
};

const StatisticsDashboard: React.FC<StatisticsDashboardProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="stats-dashboard stats-dashboard--loading">
                <p>Cargando estadísticas...</p>
            </div>
        );
    }

    const { facturas, nomina, clientes, items } = data ?? defaultData;

    // Meses en orden cronológico (el backend los devuelve descendente).
    const facturasMeses = [...facturas.porMes].reverse();
    const nominaMeses = [...nomina.porMes].reverse();

    const doughnutEstado = {
        labels: facturas.porEstado.map((e) => ESTADO_LABELS[e.estado] ?? e.estado),
        datasets: [
            {
                data: facturas.porEstado.map((e) => e.count),
                backgroundColor: facturas.porEstado.map((e) => ESTADO_COLOR[e.estado] ?? COLORS.muted),
                borderWidth: 0,
            },
        ],
    };

    const barPorMes = {
        labels: facturasMeses.map(mesLabel),
        datasets: [{ label: "Documentos", data: facturasMeses.map((m) => m.count), backgroundColor: COLORS.primary, borderRadius: 4 }],
    };

    const lineValorPorMes = {
        labels: facturasMeses.map(mesLabel),
        datasets: [
            {
                label: "Facturado (M)",
                data: facturasMeses.map((m) => m.totalValorAPagar / 1_000_000),
                borderColor: COLORS.success,
                backgroundColor: "rgba(34, 197, 94, 0.12)",
                fill: true,
                tension: 0.3,
            },
        ],
    };

    const barTipoDoc = {
        labels: facturas.porTipoDocumento.map((t) => t.tipo),
        datasets: [
            {
                label: "Cantidad",
                data: facturas.porTipoDocumento.map((t) => t.count),
                backgroundColor: COLORS.palette.slice(0, facturas.porTipoDocumento.length),
                borderRadius: 4,
            },
        ],
    };

    const barPorPrefijo = {
        labels: facturas.porPrefijo.map((p) => p.prefijo),
        datasets: [
            {
                label: "Documentos",
                data: facturas.porPrefijo.map((p) => p.count),
                backgroundColor: COLORS.teal,
                borderRadius: 4,
            },
        ],
    };

    const barNominaPorMes = {
        labels: nominaMeses.map(mesLabel),
        datasets: [{ label: "Nóminas", data: nominaMeses.map((m) => m.count), backgroundColor: COLORS.teal, borderRadius: 4 }],
    };

    const doughnutItems = {
        labels: items.porTipo.map((t) => t.kind),
        datasets: [{ data: items.porTipo.map((t) => t.count), backgroundColor: [COLORS.primary, COLORS.warning], borderWidth: 0 }],
    };

    const barClientesPorTipo = {
        labels: clientes.porTipoDocumento.map((t) => t.doc_type),
        datasets: [{ label: "Clientes", data: clientes.porTipoDocumento.map((t) => t.count), backgroundColor: COLORS.muted, borderRadius: 4 }],
    };

    return (
        <div className="stats-dashboard">
            <div className="stats-dashboard__header">
                <h2 className="stats-dashboard__title">Estadísticas</h2>
                <span className="stats-dashboard__subtitle">Indicadores y tendencias de tu facturación</span>
            </div>

            <div className="pa-grid">
                <KpiCard label="Facturas emitidas" value={facturas.total.toLocaleString("es-CO")} icon="ri-file-list-3-line" accent="#3b82f6" />
                <KpiCard label="Total facturado" value={formatMoney(facturas.totalFacturado)} icon="ri-money-dollar-circle-line" accent="#22c55e" hint="Ventas aprobadas" />
                <KpiCard label="Aprobadas" value={facturas.aprobadas.toLocaleString("es-CO")} icon="ri-checkbox-circle-line" accent="#16a34a" />
                <KpiCard label="Borradores" value={facturas.borradores.toLocaleString("es-CO")} icon="ri-draft-line" accent="#94a3b8" />
                <KpiCard label="Clientes" value={clientes.total.toLocaleString("es-CO")} icon="ri-group-line" accent="#0ea5e9" />
                <KpiCard label="Nóminas emitidas" value={nomina.total.toLocaleString("es-CO")} icon="ri-wallet-3-line" accent="#14b8a6" />
                <KpiCard label="Empleados activos" value={nomina.empleados.toLocaleString("es-CO")} icon="ri-team-line" accent="#a855f7" />
                <KpiCard label="Ítems (catálogo)" value={items.total.toLocaleString("es-CO")} icon="ri-box-3-line" accent="#6366f1" />
            </div>

            {facturas.total === 0 && nomina.total === 0 ? (
                <div className="stats-dashboard__empty">
                    <i className="ri-bar-chart-box-line"></i>
                    <p>Aún no hay documentos emitidos. Cuando emitas facturas o nómina verás aquí tus indicadores.</p>
                </div>
            ) : (
                <div className="stats-dashboard__charts">
                    {facturasMeses.length > 0 && (
                        <div className="stats-chart-card stats-chart-card--wide">
                            <h3 className="stats-chart-card__title">Documentos por mes</h3>
                            <div className="stats-chart-card__chart">
                                <Bar data={barPorMes} options={barOptions} />
                            </div>
                        </div>
                    )}

                    {facturasMeses.length > 0 && (
                        <div className="stats-chart-card stats-chart-card--wide">
                            <h3 className="stats-chart-card__title">Facturado por mes (millones)</h3>
                            <div className="stats-chart-card__chart">
                                <Line data={lineValorPorMes} options={barOptions} />
                            </div>
                        </div>
                    )}

                    {facturas.porEstado.length > 0 && (
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Facturas por estado</h3>
                            <div className="stats-chart-card__chart stats-chart-card__chart--doughnut">
                                <Doughnut data={doughnutEstado} options={chartOptions} />
                            </div>
                        </div>
                    )}

                    {facturas.porTipoDocumento.length > 0 && (
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Por tipo de documento</h3>
                            <div className="stats-chart-card__chart">
                                <Bar data={barTipoDoc} options={barOptions} />
                            </div>
                        </div>
                    )}

                    {facturas.porPrefijo.length > 0 && (
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Por prefijo</h3>
                            <div className="stats-chart-card__chart">
                                <Bar data={barPorPrefijo} options={barOptions} />
                            </div>
                        </div>
                    )}

                    {nominaMeses.length > 0 && (
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Nómina por mes</h3>
                            <div className="stats-chart-card__chart">
                                <Bar data={barNominaPorMes} options={barOptions} />
                            </div>
                        </div>
                    )}

                    {items.porTipo.length > 0 && (
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Productos vs servicios</h3>
                            <div className="stats-chart-card__chart stats-chart-card__chart--doughnut">
                                <Doughnut data={doughnutItems} options={chartOptions} />
                            </div>
                        </div>
                    )}

                    {clientes.porTipoDocumento.length > 0 && (
                        <div className="stats-chart-card">
                            <h3 className="stats-chart-card__title">Clientes por tipo documento</h3>
                            <div className="stats-chart-card__chart">
                                <Bar data={barClientesPorTipo} options={barOptions} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StatisticsDashboard;
