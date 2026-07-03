import { useSearchParams } from "react-router-dom";
import "../../accounting/page/Configuration.css";
import "../../purchases/page/Purchases.css";
import "./Accounting.css";
import { ListPageShell } from "../../../components/design-system";
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
import Budget from "../components/Budget";
import FinancialNotes from "../components/FinancialNotes";
import ConciliacionFiscal from "../components/ConciliacionFiscal";
import IntegrityPanel from "../components/IntegrityPanel";

type Section = "comprobantes" | "diario" | "mayor" | "terceros" | "balance" | "estados" | "notas" | "presupuesto" | "fiscal" | "ajustes" | "saldos" | "cierre" | "periodos" | "dian" | "ica" | "salud";

const NAV: { key: Section; label: string; icon: string; group: string }[] = [
    { key: "comprobantes", label: "Comprobantes", icon: "ri-file-list-3-line", group: "Movimientos" },
    { key: "diario", label: "Libro diario", icon: "ri-book-open-line", group: "Libros" },
    { key: "mayor", label: "Mayor y balances", icon: "ri-archive-line", group: "Libros" },
    { key: "terceros", label: "Auxiliar por tercero", icon: "ri-group-line", group: "Libros" },
    { key: "balance", label: "Balance de prueba", icon: "ri-scales-3-line", group: "Estados financieros" },
    { key: "estados", label: "Estados financieros", icon: "ri-line-chart-line", group: "Estados financieros" },
    { key: "notas", label: "Notas a los EEFF", icon: "ri-sticky-note-line", group: "Estados financieros" },
    { key: "presupuesto", label: "Presupuesto", icon: "ri-bar-chart-grouped-line", group: "Estados financieros" },
    { key: "fiscal", label: "Conciliación fiscal", icon: "ri-git-merge-line", group: "Estados financieros" },
    { key: "ajustes", label: "Ajustes contables", icon: "ri-equalizer-line", group: "Procesos" },
    { key: "saldos", label: "Saldos iniciales", icon: "ri-flag-line", group: "Procesos" },
    { key: "cierre", label: "Cierre anual", icon: "ri-lock-2-line", group: "Procesos" },
    { key: "periodos", label: "Períodos", icon: "ri-calendar-close-line", group: "Procesos" },
    { key: "salud", label: "Salud contable", icon: "ri-shield-check-line", group: "Procesos" },
    { key: "dian", label: "DIAN / Exógena", icon: "ri-government-line", group: "DIAN" },
    { key: "ica", label: "ReteICA por municipio", icon: "ri-map-pin-2-line", group: "DIAN" },
];

const AccountingPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    // La sección activa se deriva del query `?sec=` que controla el menú lateral principal.
    const requested = searchParams.get("sec") as Section | null;
    const section: Section = requested && NAV.some((n) => n.key === requested) ? requested : "comprobantes";

    const actual = NAV.find((n) => n.key === section);

    return (
        <ListPageShell className="config-page container-scroll">
            {/* El menú de secciones vive en el sidebar principal (izquierda) vía ?sec=, así que
                aquí ya no se duplica un aside interno: solo mostramos la sección activa. */}
            <div className="config-shell config-shell--full">
                <section className="config-content">
                    <h1 className="config-title config-title--page"><i className={actual?.icon ?? "ri-book-2-line"} /> {actual?.label ?? "Contabilidad"}</h1>
                    {section === "comprobantes" && <JournalEntries />}
                    {section === "diario" && <JournalBook />}
                    {section === "mayor" && <GeneralLedger />}
                    {section === "terceros" && <ThirdPartyLedger />}
                    {section === "balance" && <TrialBalance />}
                    {section === "estados" && <FinancialStatements />}
                    {section === "notas" && <FinancialNotes />}
                    {section === "presupuesto" && <Budget />}
                    {section === "fiscal" && <ConciliacionFiscal />}
                    {section === "ajustes" && <Adjustments />}
                    {section === "saldos" && <InitialBalances />}
                    {section === "cierre" && <YearClosing />}
                    {section === "periodos" && <Periods />}
                    {section === "salud" && <IntegrityPanel />}
                    {section === "dian" && <DianExogena />}
                    {section === "ica" && <IcaMunicipio />}
                </section>
            </div>
        </ListPageShell>
    );
};

export default AccountingPage;
