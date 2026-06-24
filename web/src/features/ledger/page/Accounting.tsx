import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../../accounting/page/Configuration.css";
import "./Accounting.css";
import JournalEntries from "../components/JournalEntries";
import JournalBook from "../components/JournalBook";
import Periods from "../components/Periods";
import TrialBalance from "../components/TrialBalance";
import GeneralLedger from "../components/GeneralLedger";
import ThirdPartyLedger from "../components/ThirdPartyLedger";
import FinancialStatements from "../components/FinancialStatements";
import InitialBalances from "../components/InitialBalances";
import YearClosing from "../components/YearClosing";
import DianExogena from "../components/DianExogena";
import IcaMunicipio from "../components/IcaMunicipio";
import Adjustments from "../components/Adjustments";

type Section = "comprobantes" | "diario" | "mayor" | "terceros" | "balance" | "estados" | "ajustes" | "saldos" | "cierre" | "periodos" | "dian" | "ica";

const NAV: { key: Section; label: string; icon: string; group: string }[] = [
    { key: "comprobantes", label: "Comprobantes", icon: "ri-file-list-3-line", group: "Movimientos" },
    { key: "diario", label: "Libro diario", icon: "ri-book-open-line", group: "Libros" },
    { key: "mayor", label: "Mayor y balances", icon: "ri-archive-line", group: "Libros" },
    { key: "terceros", label: "Auxiliar por tercero", icon: "ri-group-line", group: "Libros" },
    { key: "balance", label: "Balance de prueba", icon: "ri-scales-3-line", group: "Estados financieros" },
    { key: "estados", label: "Estados financieros", icon: "ri-line-chart-line", group: "Estados financieros" },
    { key: "ajustes", label: "Ajustes contables", icon: "ri-equalizer-line", group: "Procesos" },
    { key: "saldos", label: "Saldos iniciales", icon: "ri-flag-line", group: "Procesos" },
    { key: "cierre", label: "Cierre anual", icon: "ri-lock-2-line", group: "Procesos" },
    { key: "periodos", label: "Períodos", icon: "ri-calendar-close-line", group: "Procesos" },
    { key: "dian", label: "DIAN / Exógena", icon: "ri-government-line", group: "DIAN" },
    { key: "ica", label: "ReteICA por municipio", icon: "ri-map-pin-2-line", group: "DIAN" },
];

const AccountingPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initial = (searchParams.get("sec") as Section) || "comprobantes";
    const [section, setSection] = useState<Section>(NAV.some((n) => n.key === initial) ? initial : "comprobantes");

    const go = (s: Section) => {
        setSection(s);
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set("sec", s);
            return p;
        });
    };

    const groups = [...new Set(NAV.map((n) => n.group))];

    return (
        <main className="config-page">
            <div className="config-shell">
                <aside className="config-sidebar">
                    <h1 className="config-title"><i className="ri-book-2-line" /> Contabilidad</h1>
                    {groups.map((g) => (
                        <div key={g} className="config-nav-group">
                            <span className="config-nav-group__label">{g}</span>
                            {NAV.filter((n) => n.group === g).map((n) => (
                                <button key={n.key} className={`config-nav-item ${section === n.key ? "active" : ""}`} onClick={() => go(n.key)}>
                                    <i className={n.icon} /> {n.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </aside>
                <section className="config-content">
                    {section === "comprobantes" && <JournalEntries />}
                    {section === "diario" && <JournalBook />}
                    {section === "mayor" && <GeneralLedger />}
                    {section === "terceros" && <ThirdPartyLedger />}
                    {section === "balance" && <TrialBalance />}
                    {section === "estados" && <FinancialStatements />}
                    {section === "ajustes" && <Adjustments />}
                    {section === "saldos" && <InitialBalances />}
                    {section === "cierre" && <YearClosing />}
                    {section === "periodos" && <Periods />}
                    {section === "dian" && <DianExogena />}
                    {section === "ica" && <IcaMunicipio />}
                </section>
            </div>
        </main>
    );
};

export default AccountingPage;
