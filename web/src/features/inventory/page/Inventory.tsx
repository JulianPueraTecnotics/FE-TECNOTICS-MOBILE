import { useSearchParams } from "react-router-dom";
import "../../accounting/page/Configuration.css";
import "../../ledger/page/Accounting.css";
import "../../purchases/page/Purchases.css";
import "./Inventory.css";
import Existencias from "../components/Existencias";
import Kardex from "../components/Kardex";
import Valorizado from "../components/Valorizado";
import Bodegas from "../components/Bodegas";
import Ajustes from "../components/Ajustes";
import Traslados from "../components/Traslados";
import SaldosIniciales from "../components/SaldosIniciales";

type Section = "existencias" | "kardex" | "valorizado" | "bodegas" | "ajustes" | "traslados" | "saldos";

const NAV: { key: Section; label: string; icon: string }[] = [
    { key: "existencias", label: "Existencias", icon: "ri-stack-line" },
    { key: "kardex", label: "Kardex", icon: "ri-file-list-3-line" },
    { key: "valorizado", label: "Inventario valorizado", icon: "ri-money-dollar-circle-line" },
    { key: "bodegas", label: "Bodegas", icon: "ri-building-line" },
    { key: "ajustes", label: "Ajuste de inventario", icon: "ri-equalizer-line" },
    { key: "traslados", label: "Traslado entre bodegas", icon: "ri-arrow-left-right-line" },
    { key: "saldos", label: "Saldos iniciales", icon: "ri-flag-line" },
];

const InventoryPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    // La sección activa se deriva del query `?sec=` que controla el menú lateral principal.
    const requested = searchParams.get("sec") as Section | null;
    const section: Section = requested && NAV.some((n) => n.key === requested) ? requested : "existencias";

    const actual = NAV.find((n) => n.key === section);

    return (
        <main className="config-page">
            {/* El menú de secciones vive en el sidebar principal (izquierda) vía ?sec=, así que
                aquí no se duplica un aside interno: solo mostramos la sección activa. */}
            <div className="config-shell config-shell--full">
                <section className="config-content">
                    <h1 className="config-title config-title--page"><i className={actual?.icon ?? "ri-archive-2-line"} /> {actual?.label ?? "Inventario"}</h1>
                    {section === "existencias" && <Existencias />}
                    {section === "kardex" && <Kardex />}
                    {section === "valorizado" && <Valorizado />}
                    {section === "bodegas" && <Bodegas />}
                    {section === "ajustes" && <Ajustes />}
                    {section === "traslados" && <Traslados />}
                    {section === "saldos" && <SaldosIniciales />}
                </section>
            </div>
        </main>
    );
};

export default InventoryPage;
