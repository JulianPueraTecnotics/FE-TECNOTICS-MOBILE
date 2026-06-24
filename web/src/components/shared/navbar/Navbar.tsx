import "./index.css";

import logo from "../../../assets/brand.png";
import onlySimbol from "../../../assets/favicon.png";

import { PATHS } from "../../../router/paths.contants";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useContext, useEffect } from "react";
import { AuthContext } from "../../../store/auth.context";
import { useTheme } from "../../../store/theme.context";
import UserMenu from "../UserMenu/UserMenu";
import NavMenu from "../nav/NavMenu";

interface NavbarProps {
    open_sidebar: boolean;
    setOpenSidebar: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ setOpenSidebar }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const width = window.innerWidth;
    const { user } = useContext(AuthContext);
    const { theme, toggleTheme } = useTheme();

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
            navigate(homePath);
        }
    }, [user, isAuthPage, navigate, homePath]);

    // Mostrar siempre el header (también en login y registro). Nav pública si no hay usuario
    const showPublicNavbar = !user || (user && isPublicPage);
    const showPrivateNavbar = user && !isPublicPage;

    return (
        <header>
            <div className="header__container">
                <div className="header__column">
                    {width > 495 && (
                        <NavLink
                            to={PATHS.HOME}
                            className="header__brand"
                        >
                            <img
                                src={logo}
                                alt="logo"
                            />
                        </NavLink>
                    )}

                    {width < 495 && (
                        <NavLink
                            to={PATHS.HOME}
                            className="header__brand"
                        >
                            <img
                                src={onlySimbol}
                                alt="logo"
                            />
                        </NavLink>
                    )}
                </div>

                <div className="header__right">
                    {showPublicNavbar && (
                        <nav className="header__column header__navs">
                            <ul className="header__menu">
                                <li className="header__menu-item">
                                    <NavLink
                                        to={PATHS.HOME}
                                        className="header__menu-link"
                                    >
                                        <span>Inicio</span>
                                    </NavLink>
                                </li>
                                <li className="header__menu-item">
                                    <NavLink
                                        to={PATHS.HOME_HOW_IT_WORKS}
                                        className="header__menu-link"
                                    >
                                        <span>Cómo funciona</span>
                                    </NavLink>
                                </li>
                                <li className="header__menu-item">
                                    <NavLink
                                        to={PATHS.HOME_PLANS}
                                        className="header__menu-link"
                                    >
                                        <span>Planes</span>
                                    </NavLink>
                                </li>
                                <div className="header__divider"></div>

                                {!user ? (
                                    <>
                                        <li className="header__menu-item btn-secondary">
                                            <NavLink
                                                to={PATHS.LOGIN}
                                                className="header__menu-link"
                                            >
                                                <span>Iniciar sesión</span>
                                            </NavLink>
                                        </li>
                                        <li className="header__menu-item btn-secondary">
                                            <NavLink
                                                to={PATHS.REGISTER}
                                                className="header__menu-link"
                                            >
                                                <span>Registrarse</span>
                                            </NavLink>
                                        </li>
                                    </>
                                ) : (
                                    <li className="header__menu-item btn-primary">
                                        <NavLink
                                            to={homePath}
                                            className="header__menu-link"
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
                        <nav className="header__column header__navs">
                            <ul className="header__menu">
                                <li className="header__menu-item">
                                    <NavLink
                                        to={PATHS.ADMIN_HOME}
                                        end
                                        className="header__menu-link"
                                    >
                                        <i className="ri-building-line"></i>
                                        <span>Empresas</span>
                                    </NavLink>
                                </li>
                                <li className="header__menu-item">
                                    <NavLink
                                        to={PATHS.ADMIN_PLANS}
                                        className="header__menu-link"
                                    >
                                        <i className="ri-price-tag-3-line"></i>
                                        <span>Planes</span>
                                    </NavLink>
                                </li>
                                <li className="header__menu-item">
                                    <NavLink
                                        to={PATHS.ADMIN_ADMINS}
                                        className="header__menu-link"
                                    >
                                        <i className="ri-shield-user-line"></i>
                                        <span>Administradores</span>
                                    </NavLink>
                                </li>
                                <div className="header__divider"></div>
                                <li className="header__menu-item">
                                    <UserMenu />
                                </li>
                            </ul>
                        </nav>
                    )}

                    {showPrivateNavbar && !isSuperAdmin && (
                        <nav className="header__column header__navs header__navs--company">
                            {/* El menú de empresa vive en el sidebar izquierdo (desktop);
                                en el header solo se muestra en móvil dentro del drawer. */}
                            <div className="header__company-menu">
                                <NavMenu variant="header" />
                            </div>
                            <ul className="header__menu">
                                <div className="header__divider header__company-menu"></div>
                                <li className="header__menu-item">
                                    <UserMenu />
                                </li>
                            </ul>
                        </nav>
                    )}

                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="header__theme-toggle"
                        aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
                        title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
                    >
                        {theme === "dark" ? (
                            <i
                                className="ri-sun-line"
                                aria-hidden
                            />
                        ) : (
                            <i
                                className="ri-moon-line"
                                aria-hidden
                            />
                        )}
                    </button>
                    <button
                        onClick={setOpenSidebar}
                        className="header__menu-button button_sidebar_shared"
                    >
                        <i className="ri-menu-line"></i>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
