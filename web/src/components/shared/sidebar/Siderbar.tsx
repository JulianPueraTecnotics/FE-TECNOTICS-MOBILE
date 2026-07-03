import { NavLink, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { appLogoSrc } from "../../../assets/app-logo";
import { APP_BRAND_NAME } from "../../../utils/global";

import "./index.css";
import { useContext, useEffect } from "react";
import { AuthContext } from "../../../store/auth.context";
import { PATHS } from "../../../router/paths.contants";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import NavMenu from "../nav/NavMenu";
import ThemeToggle from "../theme/ThemeToggle";
import { logoutService } from "../../../services/auth.service";
import { clearSessionHint } from "../../../store/auth.service";

interface SidebarProps {
    is_open: boolean;
    open_sidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ is_open, open_sidebar }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, setUser } = useContext(AuthContext);
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

    const isCompanySession = showPrivateNavbar && !isSuperAdmin;

    useEffect(() => {
        const root = document.documentElement;
        if (isCompanySession) root.classList.add("has-app-sidebar");
        else root.classList.remove("has-app-sidebar");
        return () => root.classList.remove("has-app-sidebar");
    }, [isCompanySession]);

    const handleNavClick = () => {
        if (window.innerWidth < 768 && is_open) {
            open_sidebar();
        }
    };

    const handleLogout = async () => {
        try {
            const response = await logoutService();
            if (response?.success) {
                toast.success("Sesión cerrada exitosamente");
            }
        } catch (error) {
            console.error("Error al cerrar sesión:", error);
        } finally {
            clearSessionHint();
            setUser(null);
            navigate(PATHS.LOGIN);
            handleNavClick();
        }
    };

    return (
        <div className={is_open ? "sidebar sidebar__open" : "sidebar sidebar__closed"}>
            <div className="siderbar__container">
                <div className="sidebar__header">
                    <div className="sidebar__brand">
                        <img src={appLogoSrc} alt="logo" className="app-logo" />
                        <span className="sidebar__brand-name">{APP_BRAND_NAME}</span>
                    </div>
                    <div className="sidebar__header-actions">
                        <ThemeToggle className="sidebar__theme-toggle" />
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
                            <li className="sidebar__menu-item">
                                <NavLink
                                    to={PATHS.ADMIN_CONTADORES}
                                    className="sidebar__menu-link"
                                    onClick={handleNavClick}
                                >
                                    <i className="ri-user-star-line"></i>
                                    <span>Contadores</span>
                                </NavLink>
                            </li>
                        </ul>
                    </nav>
                )}

                {showPrivateNavbar && !isSuperAdmin && (
                    <nav className="sidebar__column sidebar__navs sidebar__navs--company">
                        <div className="sidebar__company">
                            <span className="sidebar__company-label">Empresa</span>
                            <p className="sidebar__company-name" title={user?.razon_social}>
                                {user?.razon_social || "—"}
                            </p>
                        </div>
                        <NavMenu variant="sidebar" onNavigate={handleNavClick} />
                        <div className="sidebar__footer">
                            <button
                                type="button"
                                className="sidebar__menu-link sidebar__logout"
                                onClick={handleLogout}
                            >
                                <i className="ri-logout-box-line" aria-hidden />
                                <span>Cerrar sesión</span>
                            </button>
                        </div>
                    </nav>
                )}
            </div>
        </div>
    );
};

export default Sidebar;