import { NavLink, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../store/auth.context";
import { useTheme } from "../../store/theme.context";
import { PATHS } from "../../router/paths.contants";
import NavMenu from "../shared/nav/NavMenu";
import logo from "../../assets/brand.png";
import "../shared/sidebar/index.css";
import "../shared/nav/NavMenu.css";
import "./mobile-shell.css";

interface MobileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const { theme, toggleTheme } = useTheme();

    const publicPaths = [PATHS.HOME];

    const isPublicPage = publicPaths.includes(location.pathname);
    const isSuperAdmin = user?.role === "super_admin";
    const homePath = isSuperAdmin ? PATHS.ADMIN_HOME : PATHS.DASHBOARD;

    const showPublicNav = !user || (user && isPublicPage);
    const showPrivateNav = user && !isPublicPage;

    const handleNavClick = () => {
        onClose();
    };

    return (
        <>
            <div
                className={`mobile-drawer-overlay${isOpen ? " mobile-drawer-overlay--open" : ""}`}
                onClick={onClose}
                aria-hidden={!isOpen}
            />
            <aside
                className={`mobile-drawer${isOpen ? " mobile-drawer--open" : ""}`}
                aria-hidden={!isOpen}
                aria-label="Menú de navegación"
            >
                <div className="mobile-drawer__header">
                    <div className="mobile-drawer__brand">
                        <img src={logo} alt="Tecnotics" />
                    </div>
                    <div className="mobile-drawer__actions">
                        <button
                            type="button"
                            className="mobile-header__icon-btn"
                            onClick={toggleTheme}
                            aria-label={theme === "dark" ? "Tema claro" : "Tema oscuro"}
                        >
                            {theme === "dark" ? (
                                <i className="ri-sun-line" aria-hidden />
                            ) : (
                                <i className="ri-moon-line" aria-hidden />
                            )}
                        </button>
                        <button
                            type="button"
                            className="mobile-header__icon-btn"
                            onClick={onClose}
                            aria-label="Cerrar menú"
                        >
                            <i className="ri-close-line" aria-hidden />
                        </button>
                    </div>
                </div>

                <div className="mobile-drawer__scroll">
                    {showPublicNav && (
                        <nav className="sidebar__navs">
                            <ul className="sidebar__menu">
                                <li className="sidebar__menu-item">
                                    <NavLink to={PATHS.HOME} className="sidebar__menu-link" onClick={handleNavClick}>
                                        <i className="ri-home-line" aria-hidden />
                                        <span>Inicio</span>
                                    </NavLink>
                                </li>
                                <li className="sidebar__menu-item">
                                    <NavLink
                                        to={PATHS.HOME_HOW_IT_WORKS}
                                        className="sidebar__menu-link"
                                        onClick={handleNavClick}
                                    >
                                        <i className="ri-lightbulb-line" aria-hidden />
                                        <span>Cómo funciona</span>
                                    </NavLink>
                                </li>
                                <li className="sidebar__menu-item">
                                    <NavLink to={PATHS.HOME_PLANS} className="sidebar__menu-link" onClick={handleNavClick}>
                                        <i className="ri-price-tag-3-line" aria-hidden />
                                        <span>Planes</span>
                                    </NavLink>
                                </li>
                                <div className="mobile-drawer__divider" />
                                {!user ? (
                                    <>
                                        <li className="sidebar__menu-item btn-secondary">
                                            <NavLink to={PATHS.LOGIN} className="sidebar__menu-link" onClick={handleNavClick}>
                                                <span>Iniciar sesión</span>
                                            </NavLink>
                                        </li>
                                        <li className="sidebar__menu-item btn-secondary">
                                            <NavLink to={PATHS.REGISTER} className="sidebar__menu-link" onClick={handleNavClick}>
                                                <span>Registrarse</span>
                                            </NavLink>
                                        </li>
                                    </>
                                ) : (
                                    <li className="sidebar__menu-item btn-primary">
                                        <NavLink to={homePath} className="sidebar__menu-link" onClick={handleNavClick}>
                                            <i className="ri-arrow-right-line" aria-hidden />
                                            <span>{isSuperAdmin ? "Volver al panel" : "Volver a facturación"}</span>
                                        </NavLink>
                                    </li>
                                )}
                            </ul>
                        </nav>
                    )}

                    {showPrivateNav && isSuperAdmin && (
                        <nav className="sidebar__navs">
                            <ul className="sidebar__menu">
                                <li className="sidebar__menu-item">
                                    <NavLink
                                        to={PATHS.ADMIN_HOME}
                                        end
                                        className="sidebar__menu-link"
                                        onClick={handleNavClick}
                                    >
                                        <i className="ri-building-line" aria-hidden />
                                        <span>Empresas</span>
                                    </NavLink>
                                </li>
                                <li className="sidebar__menu-item">
                                    <NavLink to={PATHS.ADMIN_PLANS} className="sidebar__menu-link" onClick={handleNavClick}>
                                        <i className="ri-price-tag-3-line" aria-hidden />
                                        <span>Planes</span>
                                    </NavLink>
                                </li>
                                <li className="sidebar__menu-item">
                                    <NavLink to={PATHS.ADMIN_ADMINS} className="sidebar__menu-link" onClick={handleNavClick}>
                                        <i className="ri-shield-user-line" aria-hidden />
                                        <span>Administradores</span>
                                    </NavLink>
                                </li>
                            </ul>
                        </nav>
                    )}

                    {showPrivateNav && !isSuperAdmin && (
                        <nav className="sidebar__navs">
                            <NavMenu variant="sidebar" onNavigate={handleNavClick} />
                        </nav>
                    )}
                </div>
            </aside>
        </>
    );
};

export default MobileDrawer;
