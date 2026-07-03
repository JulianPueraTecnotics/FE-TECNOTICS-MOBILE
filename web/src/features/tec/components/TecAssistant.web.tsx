import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../../store/auth.context";
import TecChat from "./TecChat";
import { setTecContext, getTecContext } from "../tec-context";
import { useBlockTecFab } from "../useBlockTecFab";
import TecAvatar from "../../../assets/Tec_asistente.png";
import "./tec.css";

/** Fallback de pantalla por ruta: si la página no publicó contexto detallado, al menos
 *  el asistente sabe dónde está el usuario. Las páginas con datos finos lo sobrescriben. */
const RUTA_PANTALLA: { match: (p: string) => boolean; pantalla: string; titulo: string }[] = [
    { match: (p) => p.startsWith("/facturar"), pantalla: "facturas", titulo: "Facturar (nueva factura de venta)" },
    { match: (p) => p.startsWith("/documentos"), pantalla: "facturas", titulo: "Histórico de facturas de venta" },
    { match: (p) => p.startsWith("/compras"), pantalla: "compras", titulo: "Compras" },
    { match: (p) => p.startsWith("/gastos"), pantalla: "gastos", titulo: "Gastos" },
    { match: (p) => p.startsWith("/contabilidad") || p.startsWith("/comprobantes") || p.startsWith("/libros"), pantalla: "contabilidad", titulo: "Contabilidad" },
    { match: (p) => p.startsWith("/tesoreria"), pantalla: "tesoreria", titulo: "Tesorería" },
    { match: (p) => p.startsWith("/conciliacion") || p.startsWith("/dian/conciliacion"), pantalla: "conciliacion", titulo: "Consola de conciliación bancaria" },
    { match: (p) => p.startsWith("/recaudos"), pantalla: "recaudos", titulo: "Recaudos" },
    { match: (p) => p.startsWith("/dashboard"), pantalla: "inicio", titulo: "Panel de inicio (dashboard)" },
];

/**
 * Asistente TEC — launcher retraído (logo + flecha) pegado a la derecha;
 * al expandir muestra el saludo; segundo clic abre el panel lateral de chat.
 */
const TecAssistant: React.FC = () => {
    const { user, isLoading } = useContext(AuthContext);
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [launcherExpanded, setLauncherExpanded] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const hideLauncher = useBlockTecFab();

    useEffect(() => {
        const r = RUTA_PANTALLA.find((x) => x.match(location.pathname));
        const actual = getTecContext();
        if (r && (!actual || actual.pantalla !== r.pantalla)) {
            setTecContext({ pantalla: r.pantalla, titulo: r.titulo });
        }
    }, [location.pathname]);

    useEffect(() => {
        if (!hideLauncher) return;
        setOpen(false);
        setLauncherExpanded(false);
    }, [hideLauncher]);

    if (isLoading || !user || !user.id || user.role === "super_admin") return null;

    const showLauncher = !hideLauncher && !open;

    const handleLauncherClick = () => {
        if (!launcherExpanded) {
            setLauncherExpanded(true);
            return;
        }
        setOpen(true);
    };

    const handleClosePanel = () => {
        setOpen(false);
        setLauncherExpanded(false);
    };

    return (
        <>
            {showLauncher && (
                <button
                    type="button"
                    className={`tec-launcher ${launcherExpanded ? "tec-launcher--expanded" : ""}`}
                    onClick={handleLauncherClick}
                    aria-label={launcherExpanded ? "Abrir asistente TEC" : "Expandir asistente TEC"}
                    aria-expanded={launcherExpanded}
                >
                    <span className="tec-launcher__greeting">¿En qué te puedo ayudar?</span>
                    <span className="tec-launcher__core">
                        <span className="tec-launcher__box">
                            {avatarFailed ? (
                                <span className="tec-launcher__logo-fallback" aria-hidden>🤖</span>
                            ) : (
                                <img
                                    src={TecAvatar}
                                    alt=""
                                    className="tec-launcher__logo"
                                    aria-hidden
                                    onError={() => setAvatarFailed(true)}
                                />
                            )}
                        </span>
                        <i className="ri-arrow-left-s-line tec-launcher__chevron" aria-hidden />
                    </span>
                </button>
            )}

            <div
                className={`tec-overlay ${open ? "tec-overlay--open" : ""}`}
                onClick={handleClosePanel}
                aria-hidden="true"
            />

            <div
                className={`tec-panel ${open ? "tec-panel--open" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Asistente TEC"
            >
                {open && <TecChat onClose={handleClosePanel} />}
            </div>
        </>
    );
};

export default TecAssistant;
