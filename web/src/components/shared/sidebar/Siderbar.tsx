import { NavLink, useLocation, useNavigate } from "react-router-dom";

import logo from "../../../assets/brand.png";

import "./index.css";
import { useContext, useEffect } from "react";
import { AuthContext } from "../../../store/auth.context";
import { useTheme } from "../../../store/theme.context";
import { PATHS } from "../../../router/paths.contants";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import NavMenu from "../nav/NavMenu";

interface SidebarProps {
    is_open: boolean;
    open_sidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ is_open, open_sidebar }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const { theme, toggleTheme } = useTheme();
    useBodyScrollLock(is_open);

    // Define public paths
    const publicPaths = [PATHS.HOME];
    const authPaths = [PATHS.LOGIN, PATHS.REGISTER];

    const isAuthPage = authPaths.includes(location.pathname);
    const isPublicPage = publicPaths.includes(location.pathname);
    const isSuperAdmin = user?.role === "super_admin";
    const homePath = isSuperAdmin ? PATHS.ADMIN_HOME : PATHS.DASHBOARD;

    // Redirect authenticated users away from login/register pages
    useEffect(() => {
        if (user && isAuthPage) {
            navigate(homePath, { replace: true });
        }
    }, [user, isAuthPage, navigate, homePath]);

    // Mostrar siempre el sidebar (también en login y registro). Nav pública si no hay usuario
    const showPublicNavbar = !user || (user && isPublicPage);
    const showPrivateNavbar = user && !isPublicPage;

    // El sidebar de empresa (menú lateral fijo en desktop) solo aplica para sesión de empresa/subusuario.
    // Marcamos <html> para que el body reserve el espacio del sidebar (padding-left) solo en ese caso.
    const isAppSidebar = Boolean(showPrivateNavbar && !isSuperAdmin);
    useEffect(() => {
        const root = document.documentElement;
        if (isAppSidebar) root.classList.add("has-app-sidebar");
        else root.classList.remove("has-app-sidebar");
        return () => root.classList.remove("has-app-sidebar");
    }, [isAppSidebar]);

    const handleNavClick = () => {
        if (window.innerWidth <= 495 && is_open) {
            open_sidebar();
        }
    };

    return (
        <div className={is_open ? "sidebar sidebar__open" : "sidebar sidebar__closed"}>
            <div className="siderbar__container">
                <div className="sidebar__header">
                    <div className="sidebar__brand">
                        <img src={logo} alt="logo" />
                    </div>
                    <div className="sidebar__header-actions">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="sidebar__theme-toggle"
                            aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
                        >
                            {theme === "dark" ? (
                                <i className="ri-sun-line" aria-hidden />
                            ) : (
                                <i className="ri-moon-line" aria-hidden />
                            )}
                        </button>
                        <button onClick={open_sidebar} className="sidebar__menu-button button_sidebar_shared">
                            <i className="ri-menu-line"></i>
                        </button>
                    </div>
                </div>

                {showPublicNavbar && (
                    <nav className="sidebar__column sidebar__navs">
                        <ul className="sidebar__menu">
                            <li className="sidebar__menu-item">
                                <NavLink
                                    to={PATHS.HOME}
                                    className="sidebar__menu-link"
                                    onClick={handleNavClick}
                                >
                                    <i className="ri-home-line"></i>
                                    <span>Inicio</span>
                                </NavLink>
                            </li>
                            <li className="sidebar__menu-item">
                                <NavLink
                                    to={PATHS.HOME_HOW_IT_WORKS}
                                    className="sidebar__menu-link"
                                    onClick={handleNavClick}
                                >
                                    <i className="ri-lightbulb-line"></i>
                                    <span>Cómo funciona</span>
                                </NavLink>
                            </li>
                            <li className="sidebar__menu-item">
                                <NavLink
                                    to={PATHS.HOME_PLANS}
                                    className="sidebar__menu-link"
                                    onClick={handleNavClick}
                                >
                                    <i className="ri-price-tag-3-line"></i>
                                    <span>Planes</span>
                                </NavLink>
                            </li>
                            <div className="sidebar__divider"></div>

                            {!user ? (
                                <>
                                    <li className="sidebar__menu-item btn-secondary">
                                        <NavLink
                                            to={PATHS.LOGIN}
                                            className="sidebar__menu-link"
                                            onClick={handleNavClick}
                                        >
                                            <span>Iniciar sesión</span>
                                        </NavLink>
                                    </li>
                                    <li className="sidebar__menu-item btn-secondary">
                                        <NavLink
                                            to={PATHS.REGISTER}
                                            className="sidebar__menu-link"
                                            onClick={handleNavClick}
                                        >
                                            <span>Registrarse</span>
                                        </NavLink>
                                    </li>
                                </>
                            ) : (
                                <li className="sidebar__menu-item btn-primary">
                                    <NavLink
                                        to={homePath}
                                        className="sidebar__menu-link"
                                        onClick={handleNavClick}
                                    >
                                        <i className="ri-arrow-right-line"></i>
                                        <span>{isSuperAdmin ? "Volver al panel" : "Volver a facturación"}</span>
                                    </NavLink>
                                </li>
                            )}
                        </ul>
                    </nav>
                )}

                {showPrivateNavbar && isSuperAdmin && (
                    <nav className="sidebar__column sidebar__navs">
                        <ul className="sidebar__menu">
                            <li className="sidebar__menu-item">
                                <NavLink
                                    to={PATHS.ADMIN_HOME}
                                    end
                                    className="sidebar__menu-link"
                                    onClick={handleNavClick}
                                >
                                    <i className="ri-building-line"></i>
                                    <span>Empresas</span>
                                </NavLink>
                            </li>
                            <li className="sidebar__menu-item">
                                <NavLink
                                    to={PATHS.ADMIN_PLANS}
                                    className="sidebar__menu-link"
                                    onClick={handleNavClick}
                                >
                                    <i className="ri-price-tag-3-line"></i>
                                    <span>Planes</span>
                                </NavLink>
                            </li>
                            <li className="sidebar__menu-item">
                                <NavLink
                                    to={PATHS.ADMIN_ADMINS}
                                    className="sidebar__menu-link"
                                    onClick={handleNavClick}
                                >
                                    <i className="ri-shield-user-line"></i>
                                    <span>Administradores</span>
                                </NavLink>
                            </li>
                        </ul>
                    </nav>
                )}

                {showPrivateNavbar && !isSuperAdmin && (
                    <nav className="sidebar__column sidebar__navs">
                        <NavMenu variant="sidebar" onNavigate={handleNavClick} />
                    </nav>
                )}
            </div>
        </div>
    );
};

export default Sidebar;