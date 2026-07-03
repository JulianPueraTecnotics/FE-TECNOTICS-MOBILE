import { useContext, useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthContext } from "../../../store/auth.context";
import { PATHS } from "../../../router/paths.contants";
import { logoutService } from "../../../services/auth.service";
import { clearSessionHint } from "../../../store/auth.service";
import { ActivityNotificationsList, useActivityJobs } from "../activities/ActivityCenter";
import "../activities/ActivityCenter.css";
import "./UserMenu.css";

interface UserMenuProps {
    onNavigate?: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onNavigate }) => {
    const { user, setUser } = useContext(AuthContext);
    const [isOpen, setIsOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [avatarError, setAvatarError] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { jobs, reanudando, onReanudar, activos, badgeCount } = useActivityJobs();

    useEffect(() => {
        setAvatarError(false);
    }, [user?.avatar]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        try {
            const response = await logoutService();
            if (response?.success) {
                toast.success("Sesión cerrada exitosamente");
                clearSessionHint();
                setUser(null);
                navigate(PATHS.LOGIN);
                onNavigate?.();
            } else {
                clearSessionHint();
                setUser(null);
                navigate(PATHS.LOGIN);
                onNavigate?.();
            }
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            clearSessionHint();
            setUser(null);
            navigate(PATHS.LOGIN);
            onNavigate?.();
        }
    };

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    const closeMenu = () => {
        setIsOpen(false);
        setNotificationsOpen(false);
        onNavigate?.();
    };

    const toggleNotifications = () => {
        setNotificationsOpen((prev) => !prev);
    };

    const displayName = user?.razon_social || "Usuario";
    const initial = displayName.trim().charAt(0).toUpperCase() || "U";
    const roleLabel =
        user?.role === "super_admin" ? "Admin" : user?.role === "company" ? "Empresa" : "Usuario";

    return (
        <div
            className="user-menu"
            ref={menuRef}
        >
            <button
                type="button"
                className={`user-menu-button${isOpen ? " is-open" : ""}`}
                onClick={toggleMenu}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-label={`Menú de cuenta: ${displayName}`}
            >
                <div className="user-avatar">
                    {user?.avatar && !avatarError ? (
                        <img
                            src={user.avatar}
                            alt=""
                            onError={() => setAvatarError(true)}
                        />
                    ) : (
                        <span className="user-avatar__initial">{initial}</span>
                    )}
                </div>
                <div className="user-info">
                    <span className="user-name">{displayName}</span>
                    <span className="user-role">{roleLabel}</span>
                </div>
                <i className={`ri-arrow-down-s-line arrow-icon ${isOpen ? "open" : ""}`} aria-hidden />
            </button>

            {isOpen && (
                <div className="user-menu-dropdown">
                    {user?.role !== "super_admin" && (
                        <>
                            <NavLink
                                to={PATHS.MY_PROFILE}
                                className="menu-item"
                                onClick={closeMenu}
                            >
                                <i className="ri-user-line"></i>
                                Mi Perfil
                            </NavLink>
                            {/* Configuración de empresa: facturación, documentos, eventos, usuarios y contable. */}
                            {(user?.role === "company" || user?.role === "admin") && (
                                <NavLink
                                    to={PATHS.CONFIGURATION}
                                    className="menu-item"
                                    onClick={closeMenu}
                                >
                                    <i className="ri-settings-3-line"></i>
                                    Configuración
                                </NavLink>
                            )}
                            <button
                                type="button"
                                className={`menu-item menu-item--notifications${notificationsOpen ? " is-active" : ""}`}
                                onClick={toggleNotifications}
                                aria-expanded={notificationsOpen}
                            >
                                <i
                                    className={
                                        activos > 0 ? "ri-notification-3-fill activity-center__spin" : "ri-notification-3-line"
                                    }
                                />
                                Notificaciones
                                {badgeCount > 0 && <span className="menu-item__badge">{badgeCount}</span>}
                            </button>
                            {notificationsOpen && (
                                <div className="user-menu-notifications">
                                    <ActivityNotificationsList
                                        jobs={jobs}
                                        reanudando={reanudando}
                                        onReanudar={onReanudar}
                                    />
                                </div>
                            )}
                            <div className="menu-divider"></div>
                        </>
                    )}
                    <button
                        className="menu-item logout"
                        onClick={handleLogout}
                    >
                        <i className="ri-logout-box-line"></i>
                        Cerrar Sesión
                    </button>
                </div>
            )}
        </div>
    );
};

export default UserMenu;
