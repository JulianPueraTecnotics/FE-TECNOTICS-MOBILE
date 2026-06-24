import { useCallback, useEffect, useState } from "react";
import "../../billing-history/page/BillingHistory.css";
import "../../billing-history/components/ReportsPanel.css";
import { getCompanyStatistics, type CompanyStatisticsData } from "../../../services/company-statistics.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import StatisticsDashboard from "../../billing-history/components/StatisticsDashboard";
import ReportsPanel from "../../billing-history/components/ReportsPanel";
import FinancialDashboard from "../components/FinancialDashboard";
import TaxOpsDashboard from "../components/TaxOpsDashboard";
import type { DateRange } from "../analytics.service";

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

const iso = (d: Date) => d.toISOString().slice(0, 10);
function presetRange(preset: string): DateRange {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (preset) {
        case "mes":
            return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
        case "trimestre": {
            const q = Math.floor(m / 3) * 3;
            return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
        }
        case "anio":
            return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
        default:
            return {};
    }
}

const AnalyticsPage: React.FC = () => {
    const [tab, setTab] = useState<Tab>("resumen");
    const [preset, setPreset] = useState("anio");
    const [range, setRange] = useState<DateRange>(presetRange("anio"));

    // Data del dashboard de Ventas (operativo, sin filtro de fechas en backend).
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
        <main className="billing-history-page">
            <div className="billing-history-layout">
                <div className="billing-tabs" style={{ flexWrap: "wrap" }}>
                    {TABS.map((t) => (
                        <button key={t.key} className={`billing-tab ${tab === t.key ? "billing-tab--active" : ""}`} onClick={() => setTab(t.key)}>
                            <i className={t.icon} /> {t.label}
                        </button>
                    ))}
                </div>

                {showDateBar && (
                    <div className="reports-filters" style={{ margin: "0 0 1rem" }}>
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
                )}

                <section className="billing-history-dashboard-section">
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
            </div>
        </main>
    );
};

export default AnalyticsPage;
