import { useEffect, useState, useCallback } from "react";
import "./BillingHistory.css";
import "../components/ReportsPanel.css";
import { getCompanyStatistics, type CompanyStatisticsData } from "../../../services/company-statistics.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import StatisticsDashboard from "../components/StatisticsDashboard";
import ReportsPanel from "../components/ReportsPanel";

type Tab = "resumen" | "reportes";

const BillingHistoryPage: React.FC = () => {
    const [tab, setTab] = useState<Tab>("resumen");
    const [stats, setStats] = useState<CompanyStatisticsData | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const response = await getCompanyStatistics();
            if (response?.ok && response.data) {
                setStats(response.data);
            }
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al cargar estadísticas");
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    return (
        <main className="billing-history-page">
            <div className="billing-history-layout">
                <div className="billing-tabs">
                    <button className={`billing-tab ${tab === "resumen" ? "billing-tab--active" : ""}`} onClick={() => setTab("resumen")}>
                        Resumen
                    </button>
                    <button className={`billing-tab ${tab === "reportes" ? "billing-tab--active" : ""}`} onClick={() => setTab("reportes")}>
                        Reportes
                    </button>
                </div>

                {tab === "resumen" ? (
                    <section className="billing-history-dashboard-section" aria-label="Panel de estadísticas">
                        <StatisticsDashboard data={stats} loading={statsLoading} />
                    </section>
                ) : (
                    <section className="billing-history-dashboard-section" aria-label="Reportes de gestión">
                        <ReportsPanel />
                    </section>
                )}
            </div>
        </main>
    );
};

export default BillingHistoryPage;
