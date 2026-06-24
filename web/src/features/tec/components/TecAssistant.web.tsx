import { useContext, useState } from "react";
import { AuthContext } from "../../../store/auth.context";
import TecChat from "./TecChat";
import TecAvatar from "../../../assets/Tec_asistente.png";
import "./tec.css";

/**
 * Botón flotante del asistente TEC. Visible para CUALQUIER usuario autenticado del
 * portal (empresa, sub-usuario o admin). No aparece en login ni mientras carga la sesión.
 */
const TecAssistant: React.FC = () => {
    const { user, isLoading } = useContext(AuthContext);
    const [open, setOpen] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);

    if (isLoading || !user || !user.id || user.role === "super_admin") return null;

    return (
        <>
            {!open && (
                <button className="tec-fab" onClick={() => setOpen(true)} aria-label="Abrir asistente TEC">
                    {avatarFailed
                        ? <span className="tec-fab__avatar tec-fab__avatar--fallback">🤖</span>
                        : <img src={TecAvatar} alt="TEC" className="tec-fab__avatar" onError={() => setAvatarFailed(true)} />}
                    <span className="tec-fab__badge" aria-hidden="true">💬</span>
                    <span className="tec-fab__tooltip">¿En qué te ayudo?</span>
                </button>
            )}

            <div className={`tec-overlay ${open ? "tec-overlay--open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
            <div className={`tec-panel ${open ? "tec-panel--open" : ""}`} role="dialog" aria-label="Asistente TEC">
                {open && <TecChat onClose={() => setOpen(false)} />}
            </div>
        </>
    );
};

export default TecAssistant;
