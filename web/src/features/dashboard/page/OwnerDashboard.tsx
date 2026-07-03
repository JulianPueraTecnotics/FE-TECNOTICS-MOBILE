import "./OwnerDashboard.css";
import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListPageShell } from "../../../components/design-system";
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement,
    Tooltip, Legend, Filler,
} from "chart.js";
import type { ChartOptions } from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { AuthContext } from "../../../store/auth.context";
import { PATHS } from "../../../router/paths.contants";
import { errorToast } from "../../../components/shared/toast/toasts";
import { getTaxCalendar } from "../tax.service";
import type { TaxCalendar, VencimientoProximo } from "../tax.service";
import { getExecutiveSummary, getIva, getRetenciones, getPlMonthly, presetRange, PERIOD_PRESETS, PERIOD_LABEL } from "../../analytics/analytics.service";
import type { ExecutiveSummary, IvaReport, RetencionesReport, PlMonthlyRow, PeriodPreset } from "../../analytics/analytics.service";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

const money = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Math.round(n || 0));
const moneyShort = (n: number) => {
    const a = Math.abs(n);
    if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${Math.round(n)}`;
};

const ESTADO_META: Record<VencimientoProximo["estado"], { label: string }> = {
    vencido: { label: "Vencido" },
    critico: { label: "Crítico" },
    por_vencer: { label: "Por vencer" },
    al_dia: { label: "Al día" },
};

const OBLIG_ICON: Record<string, string> = {
    iva: "ri-percent-line",
    retefuente: "ri-scissors-cut-line",
    reteica: "ri-building-line",
    ica: "ri-store-2-line",
    autorretencion: "ri-refresh-line",
    renta: "ri-file-text-line",
    exogena: "ri-database-2-line",
};

const teal = "#5a9fb4";
const chartFont = { family: "inherit", size: 13 };

const OwnerDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [calendar, setCalendar] = useState<TaxCalendar | null>(null);
    const [resumen, setResumen] = useState<ExecutiveSummary | null>(null);
    const [iva, setIva] = useState<IvaReport | null>(null);
    const [ret, setRet] = useState<RetencionesReport | null>(null);
    const [pl, setPl] = useState<PlMonthlyRow[]>([]);
    const [cargando, setCargando] = useState(true);

    // Período de los KPIs y de la sección de impuestos: hoy / mes / trimestre / semestre / año.
    const [periodo, setPeriodo] = useState<PeriodPreset>("mes");
    const rango = useMemo(() => presetRange(periodo), [periodo]);
    const periodoLabel = PERIOD_LABEL[periodo];

    useEffect(() => {
        let activo = true;
        (async () => {
            setCargando(true);
            try {
                const [cal, exec, ivaR, retR, plR] = await Promise.allSettled([
                    getTaxCalendar(120),
                    // Los KPIs son del período elegido: el resumen DEBE llevar el rango. Sin
                    // rango, el backend suma toda la historia (mostraba la utilidad acumulada).
                    getExecutiveSummary(rango),
                    getIva(rango),
                    getRetenciones(rango),
                    getPlMonthly({}),
                ]);
                if (!activo) return;
                if (cal.status === "fulfilled") setCalendar(cal.value);
                if (exec.status === "fulfilled") setResumen(exec.value);
                if (ivaR.status === "fulfilled") setIva(ivaR.value);
                if (retR.status === "fulfilled") setRet(retR.value);
                if (plR.status === "fulfilled") setPl(plR.value);
                if (cal.status === "rejected" && exec.status === "rejected") errorToast("No se pudo cargar el panel. Revisa tu conexión.");
            } finally {
                if (activo) setCargando(false);
            }
        })();
        return () => { activo = false; };
    }, [rango]);

    const proximos = calendar?.vencimientos ?? [];
    const urgentes = proximos.filter((v) => v.estado === "vencido" || v.estado === "critico" || v.estado === "por_vencer");

    // ── Datos de gráficas ──
    const plUlt = pl.slice(-6);
    const lineData = {
        labels: plUlt.map((p) => p.periodo),
        datasets: [
            { label: "Ingresos", data: plUlt.map((p) => p.ingresos), borderColor: teal, backgroundColor: "rgba(90,159,180,0.12)", fill: true, tension: 0.35, pointRadius: 3 },
            { label: "Costos + gastos", data: plUlt.map((p) => p.costo + p.gastoOperativo), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)", fill: true, tension: 0.35, pointRadius: 3 },
        ],
    };
    const ivaSerie = (iva?.porPeriodo ?? []).slice(-6);
    const barData = {
        labels: ivaSerie.map((p) => p.periodo),
        datasets: [
            { label: "IVA generado", data: ivaSerie.map((p) => p.generado), backgroundColor: teal, borderRadius: 4 },
            { label: "IVA descontable", data: ivaSerie.map((p) => p.descontable), backgroundColor: "#f59e0b", borderRadius: 4 },
        ],
    };
    const liq = resumen ?? ({ caja: 0, cxc: 0, cxp: 0 } as ExecutiveSummary);
    const donutData = {
        labels: ["Bancos", "Por cobrar", "Por pagar"],
        datasets: [{ data: [Math.max(0, liq.caja), Math.max(0, liq.cxc), Math.max(0, liq.cxp)], backgroundColor: [teal, "#a3d5e0", "#fbbf24"], borderWidth: 0 }],
    };

    const baseOpts: ChartOptions<"line" | "bar"> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { font: chartFont, boxWidth: 14, padding: 14 }, position: "bottom" },
            tooltip: { callbacks: { label: (c) => `${c.dataset.label ?? ""}: ${money(Number(c.parsed.y ?? c.parsed))}` } },
        },
        scales: {
            x: { ticks: { font: chartFont }, grid: { display: false } },
            y: { ticks: { font: chartFont, callback: (v) => moneyShort(Number(v)) }, grid: { color: "rgba(148,163,184,0.15)" } },
        },
    };
    const donutOpts: ChartOptions<"doughnut"> = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
            legend: { labels: { font: chartFont, boxWidth: 14, padding: 12 }, position: "bottom" },
            tooltip: { callbacks: { label: (c) => `${c.label}: ${money(Number(c.parsed))}` } },
        },
    };

    return (
        <ListPageShell className="container-scroll owner-dash-shell">
        <div className="owner-dash">
            <div className="owner-dash__head">
                <div>
                    <h1>Hola{user?.razon_social ? `, ${user.razon_social.split(" ")[0]}` : ""} 👋</h1>
                    <p className="owner-dash__sub">Este es el estado de tu empresa hoy.</p>
                </div>
                <button className="owner-dash__cta" onClick={() => navigate(PATHS.DASHBOARD_BILLING)}>
                    <i className="ri-add-line" /> Nueva factura
                </button>
            </div>

            {/* ── Selector del período de los indicadores ── */}
            <div className="owner-dash__periodos" role="group" aria-label="Período de los indicadores">
                {PERIOD_PRESETS.map((p) => (
                    <button
                        key={p.k}
                        type="button"
                        className={`owner-chip ${periodo === p.k ? "owner-chip--active" : ""}`}
                        onClick={() => setPeriodo(p.k)}
                        aria-pressed={periodo === p.k}
                    >
                        {p.l}
                    </button>
                ))}
            </div>

            {/* ── Tira de KPIs rápidos ── */}
            <div className="owner-dash__strip">
                <div className="kpi-mini">
                    <span className="kpi-mini__icon" style={{ background: "rgba(90,159,180,0.14)", color: teal }}><i className="ri-bank-line" /></span>
                    <div><span className="kpi-mini__label">Caja y bancos</span><strong>{money(resumen?.caja ?? 0)}</strong></div>
                </div>
                <div className="kpi-mini">
                    <span className="kpi-mini__icon" style={{ background: "rgba(34,197,94,0.14)", color: "#16a34a" }}><i className="ri-arrow-down-circle-line" /></span>
                    <div><span className="kpi-mini__label">Por cobrar</span><strong>{money(resumen?.cxc ?? 0)}</strong></div>
                </div>
                <div className="kpi-mini">
                    <span className="kpi-mini__icon" style={{ background: "rgba(251,146,60,0.16)", color: "#ea580c" }}><i className="ri-arrow-up-circle-line" /></span>
                    <div><span className="kpi-mini__label">Por pagar</span><strong>{money(resumen?.cxp ?? 0)}</strong></div>
                </div>
                <div className="kpi-mini">
                    <span className="kpi-mini__icon" style={{ background: iva?.signo === "favor" ? "rgba(90,159,180,0.14)" : "rgba(239,68,68,0.12)", color: iva?.signo === "favor" ? teal : "#dc2626" }}><i className="ri-percent-line" /></span>
                    <div><span className="kpi-mini__label">{iva?.signo === "favor" ? "IVA a favor" : "IVA por pagar"}</span><strong>{money(Math.abs(iva?.saldo ?? 0))}</strong></div>
                </div>
                <div className="kpi-mini">
                    <span className="kpi-mini__icon" style={{ background: (resumen?.utilidadNeta ?? 0) >= 0 ? "rgba(90,159,180,0.14)" : "rgba(239,68,68,0.12)", color: (resumen?.utilidadNeta ?? 0) >= 0 ? teal : "#dc2626" }}><i className="ri-line-chart-line" /></span>
                    <div><span className="kpi-mini__label">Utilidad neta ({periodoLabel})</span><strong>{money(resumen?.utilidadNeta ?? 0)}</strong></div>
                </div>
            </div>

            {/* ── Próximos vencimientos DIAN ── */}
            <section className="owner-dash__section">
                <div className="owner-dash__section-head">
                    <h2><i className="ri-calendar-event-line" /> Próximos vencimientos DIAN</h2>
                    {calendar && (
                        <span className="owner-dash__hint">
                            IVA {calendar.periodicidad_iva} · NIT termina en {calendar.digito_nit}{calendar.meta.autodetectado ? " (autodetectado)" : ""}
                        </span>
                    )}
                </div>
                {cargando && !calendar ? (
                    <p className="owner-dash__loading"><i className="ri-loader-4-line rotating" /> Cargando calendario…</p>
                ) : proximos.length === 0 ? (
                    <p className="owner-dash__empty">No hay obligaciones próximas. Configura tu perfil tributario en Configuración › Perfil tributario para activar el calendario.</p>
                ) : (
                    <div className="owner-dash__deadlines">
                        {proximos.slice(0, 5).map((v, i) => {
                            const meta = ESTADO_META[v.estado];
                            const diasLabel = v.dias_restantes < 0
                                ? `Hace ${Math.abs(v.dias_restantes)} día(s)`
                                : v.dias_restantes === 0
                                    ? "¡Vence hoy!"
                                    : `En ${v.dias_restantes} día(s)`;
                            const fechaCorta = new Date(v.fecha_limite + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" });
                            return (
                                <article key={i} className={`deadline-card deadline-card--${v.estado}`}>
                                    <div className="deadline-card__head">
                                        <span className="deadline-card__icon" aria-hidden>
                                            <i className={OBLIG_ICON[v.obligacion] ?? "ri-file-list-3-line"} />
                                        </span>
                                        <div className="deadline-card__body">
                                            <h3 className="deadline-card__oblig">{v.obligacion_label}</h3>
                                            <p className="deadline-card__periodo">
                                                {v.periodo_label}
                                                {!v.fecha_exacta && (
                                                    <span className="deadline-card__est" title="Fecha estimada — verifica el día exacto en el calendario DIAN"> · ≈</span>
                                                )}
                                            </p>
                                        </div>
                                        <span className={`deadline-card__badge deadline-card__badge--${v.estado}`}>{meta.label}</span>
                                    </div>
                                    <div className="deadline-card__foot">
                                        <span className="deadline-card__fecha">{fechaCorta}</span>
                                        <span className="deadline-card__sep" aria-hidden>·</span>
                                        <span className="deadline-card__dias">{diasLabel}</span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
                {urgentes.length > 0 && (
                    <div className="owner-dash__alert">
                        <i className="ri-alarm-warning-line" /> Tienes <strong>{urgentes.length}</strong> obligación(es) próxima(s) a vencer.
                    </div>
                )}
            </section>

            {/* ── Gráficas ── */}
            <div className="owner-dash__charts">
                <section className="chart-card chart-card--wide">
                    <h3><i className="ri-line-chart-line" /> Ingresos vs. costos y gastos</h3>
                    <div className="chart-card__canvas">
                        {plUlt.length >= 2 ? <Line data={lineData} options={baseOpts as ChartOptions<"line">} /> : <p className="owner-dash__empty">Sin histórico suficiente todavía.</p>}
                    </div>
                </section>

                <section className="chart-card">
                    <h3><i className="ri-pie-chart-2-line" /> Liquidez</h3>
                    <div className="chart-card__canvas chart-card__canvas--donut">
                        {(liq.caja || liq.cxc || liq.cxp) ? <Doughnut data={donutData} options={donutOpts} /> : <p className="owner-dash__empty">Sin datos de liquidez.</p>}
                    </div>
                    <button className="chart-card__link" onClick={() => navigate(PATHS.TREASURY_CARTERA)}>Ver cartera →</button>
                </section>

                <section className="chart-card">
                    <h3><i className="ri-scales-3-line" /> {periodo === "dia" ? "Impuestos de hoy" : `Impuestos del ${periodoLabel}`}</h3>
                    <div className="kpi-rows">
                        <div className="kpi-row"><span>IVA generado</span><strong>{money(iva?.generado ?? 0)}</strong></div>
                        <div className="kpi-row"><span>IVA descontable</span><strong>{money(iva?.descontable ?? 0)}</strong></div>
                        <div className="kpi-row kpi-row--total"><span>{iva?.signo === "favor" ? "Saldo a favor" : "IVA por pagar"}</span><strong style={{ color: iva?.signo === "favor" ? teal : "#dc2626" }}>{money(Math.abs(iva?.saldo ?? 0))}</strong></div>
                        <div className="kpi-row"><span>Retenciones practicadas</span><strong>{money(ret?.totalPracticadas ?? 0)}</strong></div>
                        <div className="kpi-row"><span>Retenciones sufridas</span><strong>{money(ret?.totalSufridas ?? 0)}</strong></div>
                    </div>
                    <button className="chart-card__link" onClick={() => navigate(PATHS.ANALYTICS)}>Ver estadísticas →</button>
                </section>

                <section className="chart-card chart-card--wide">
                    <h3><i className="ri-bar-chart-grouped-line" /> IVA generado vs. descontable</h3>
                    <div className="chart-card__canvas">
                        {ivaSerie.length >= 1 ? <Bar data={barData} options={baseOpts as ChartOptions<"bar">} /> : <p className="owner-dash__empty">Sin movimientos de IVA en el periodo.</p>}
                    </div>
                </section>
            </div>
        </div>
        </ListPageShell>
    );
};

export default OwnerDashboard;
