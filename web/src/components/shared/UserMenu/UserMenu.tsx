import { useContext, useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthContext } from "../../../store/auth.context";
import { PATHS } from "../../../router/paths.contants";
import { logoutService } from "../../../services/auth.service";
import "./UserMenu.css";

interface UserMenuProps {
    onNavigate?: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onNavigate }) => {
    const { user, setUser } = useContext(AuthContext);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

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
                setUser(null);
                navigate(PATHS.LOGIN);
                onNavigate?.();
            } else {
                // Aun si falla, cerramos sesión en el frontend
                setUser(null);
                navigate(PATHS.LOGIN);
                onNavigate?.();
            }
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            // Aun si hay error, cerramos sesión en el frontend
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
        onNavigate?.();
    };

    return (
        <div
            className="user-menu"
            ref={menuRef}
        >
            <button
                className="user-menu-button"
                onClick={toggleMenu}
            >
                <div className="user-avatar">
                    <img
                        src={user?.avatar || ""}
                        alt="avatar"
                    />
                </div>
                <div className="user-info">
                    <span className="user-name">{user?.razon_social || "Usuario"}</span>
                    <span className="user-role">{user?.role === "super_admin" ? "ADMIN" : user?.role === "company" ? "EMPRESA" : "USUARIO"}</span>
                </div>
                <i className={`ri-arrow-down-s-line arrow-icon ${isOpen ? "open" : ""}`}></i>
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
