import "./index.css";

import { appLogoSrc } from "../../../assets/app-logo";
import { APP_BRAND_NAME } from "../../../utils/global";

import { PATHS } from "../../../router/paths.contants";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useContext, useEffect } from "react";
import { AuthContext } from "../../../store/auth.context";
import UserMenu from "../UserMenu/UserMenu";
import ThemeToggle from "../theme/ThemeToggle";

interface NavbarProps {
    open_sidebar: boolean;
    setOpenSidebar: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ setOpenSidebar }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

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

    const isCompanySession = showPrivateNavbar && !isSuperAdmin;

    const brandLink = (
        <NavLink to={user ? homePath : PATHS.HOME} className="header__brand">
            <img src={appLogoSrc} alt="logo" className="app-logo" />
            <span className="header__brand-name">{APP_BRAND_NAME}</span>
        </NavLink>
    );

    const accountTools = (
        <div className="header__account-tools">
            {showPrivateNavbar && <UserMenu />}
            <ThemeToggle className="header__theme-toggle" />
            <button
                onClick={setOpenSidebar}
                className="header__menu-button button_sidebar_shared"
                aria-label="Abrir menú"
            >
                <i className="ri-menu-line"></i>
            </button>
        </div>
    );

    return (
        <header className={`app-header${isCompanySession ? " app-header--company" : ""}`}>
            {isCompanySession ? (
                <div className="header__container">
                    <div className="header__column">{brandLink}</div>
                    <div className="header__right">{accountTools}</div>
                </div>
            ) : (
            <div className="header__container">
                <div className="header__column">
                    {brandLink}
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
                            </ul>
                        </nav>
                    )}

                    <div className="header__account-tools">
                        {showPrivateNavbar && (
                            <>
                                <UserMenu />
                            </>
                        )}
                        <ThemeToggle className="header__theme-toggle" />
                        <button
                            onClick={setOpenSidebar}
                            className="header__menu-button button_sidebar_shared"
                            aria-label="Abrir menú"
                        >
                            <i className="ri-menu-line"></i>
                        </button>
                    </div>
                </div>
            </div>
            )}
        </header>
    );
};

export default Navbar;
