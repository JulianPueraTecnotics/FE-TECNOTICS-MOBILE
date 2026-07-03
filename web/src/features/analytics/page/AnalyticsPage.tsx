import { useCallback, useEffect, useState } from "react";
import "../../billing-history/components/ReportsPanel.css";
import "./Analytics.css";
import { getCompanyStatistics, type CompanyStatisticsData } from "../../../services/company-statistics.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import StatisticsDashboard from "../../billing-history/components/StatisticsDashboard";
import ReportsPanel from "../../billing-history/components/ReportsPanel";
import FinancialDashboard from "../components/FinancialDashboard";
import TaxOpsDashboard from "../components/TaxOpsDashboard";
import type { DateRange } from "../analytics.service";
import { presetRange, PERIOD_PRESETS } from "../analytics.service";
import { FilterField, FieldControl, ListPageContainer, ListPageHeader, ListPageShell } from "../../../components/design-system";

type Tab = "resumen" | "ventas" | "rentabilidad" | "cartera" | "tesoreria" | "tributario" | "scoring" | "nomina" | "activos";

const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "resumen", label: "Resumen ejecutivo", icon: "ri-dashboard-3-line" },
    { key: "ventas", label: "Ventas", icon: "ri-line-chart-line" },
    { key: "rentabilidad", label: "Rentabilidad", icon: "ri-funds-line" },
    { key: "cartera", label: "Cartera y CxP", icon: "ri-scales-3-line" },
    { key: "tesoreria", label: "Tesorería", icon: "ri-bank-line" },
    { key: "tributario", label: "Tributario", icon: "ri-government-line" },
    { key: "scoring", label: "Scoring", icon: "ri-trophy-line" },
    { key: "nomina", label: "Nómina", icon: "ri-team-line" },
    { key: "activos", label: "Activos", icon: "ri-computer-line" },
];

const AnalyticsPage: React.FC = () => {
    const [tab, setTab] = useState<Tab>("resumen");
    const [preset, setPreset] = useState("anio");
    const [range, setRange] = useState<DateRange>(presetRange("anio"));

    const [stats, setStats] = useState<CompanyStatisticsData | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    const applyPreset = (p: string) => {
        setPreset(p);
        if (p !== "custom") setRange(presetRange(p));
    };

    const loadStats = useCallback(async () => {
        if (stats) return;
        setStatsLoading(true);
        try {
            const res = await getCompanyStatistics();
            if (res?.ok && res.data) setStats(res.data);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar estadísticas");
        } finally {
            setStatsLoading(false);
        }
    }, [stats]);

    useEffect(() => {
        if (tab === "ventas") loadStats();
    }, [tab, loadStats]);

    const showDateBar = tab === "resumen" || tab === "rentabilidad" || tab === "tesoreria" || tab === "tributario" || tab === "nomina" || tab === "scoring";

    return (
        <ListPageShell className="analytics-page">
            <ListPageContainer>
                <ListPageHeader
                    title="Estadísticas"
                    subtitle="Indicadores financieros, operativos y tributarios de tu empresa"
                />

                <nav className="analytics-tabs" aria-label="Secciones de estadísticas">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            className={`analytics-tab ${tab === t.key ? "analytics-tab--active" : ""}`}
                            onClick={() => setTab(t.key)}
                            aria-current={tab === t.key ? "page" : undefined}
                        >
                            <i className={t.icon} aria-hidden />
                            <span>{t.label}</span>
                        </button>
                    ))}
                </nav>

                {showDateBar && (
                    <div className="analytics-filters">
                        <div className="analytics-filters__chips reports-filters">
                            {[...PERIOD_PRESETS, { k: "custom" as const, l: "Personalizado" }].map((p) => (
                                <button
                                    key={p.k}
                                    type="button"
                                    className={`reports-chip ${preset === p.k ? "reports-chip--active" : ""}`}
                                    onClick={() => applyPreset(p.k)}
                                >
                                    {p.l}
                                </button>
                            ))}
                        </div>
                        {preset === "custom" && (
                            <div className="analytics-filters__custom led-form-grid">
                                <FilterField label="Desde" htmlFor="analytics-from" icon="ri-calendar-line">
                                    <FieldControl
                                        id="analytics-from"
                                        type="date"
                                        value={range.from ?? ""}
                                        onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                                    />
                                </FilterField>
                                <FilterField label="Hasta" htmlFor="analytics-to" icon="ri-calendar-line">
                                    <FieldControl
                                        id="analytics-to"
                                        type="date"
                                        value={range.to ?? ""}
                                        onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                                    />
                                </FilterField>
                            </div>
                        )}
                    </div>
                )}

                <section className="analytics-body" aria-label="Contenido de estadísticas">
                    {tab === "resumen" && <FinancialDashboard tab="resumen" range={range} />}
                    {tab === "rentabilidad" && <FinancialDashboard tab="rentabilidad" range={range} />}
                    {tab === "tesoreria" && <FinancialDashboard tab="tesoreria" range={range} />}
                    {tab === "ventas" && <StatisticsDashboard data={stats} loading={statsLoading} />}
                    {tab === "cartera" && <ReportsPanel />}
                    {tab === "tributario" && <TaxOpsDashboard tab="tributario" range={range} />}
                    {tab === "scoring" && <TaxOpsDashboard tab="scoring" range={range} />}
                    {tab === "nomina" && <TaxOpsDashboard tab="nomina" range={range} />}
                    {tab === "activos" && <TaxOpsDashboard tab="activos" range={range} />}
                </section>
            </ListPageContainer>
        </ListPageShell>
    );
};

export default AnalyticsPage;
