import { NavLink, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../store/auth.context";
import { useTheme } from "../../store/theme.context";
import { PATHS } from "../../router/paths.contants";
import UserMenu from "../shared/UserMenu/UserMenu";
import logo from "../../assets/brand.png";
import favicon from "../../assets/favicon.png";
import "./mobile-shell.css";

interface MobileHeaderProps {
    onOpenMenu: () => void;
    showMenuButton: boolean;
}

const PAGE_TITLES: Record<string, string> = {
    [PATHS.DASHBOARD]: "Facturar",
    [PATHS.DOCUMENTS]: "Facturas",
    [PATHS.CLIENTS]: "Clientes",
    [PATHS.PRODUCTS_SERVICES]: "Productos",
    [PATHS.TERCEROS]: "Terceros",
    [PATHS.NOMINA_EMPLEADOS]: "Nómina",
    [PATHS.ANALYTICS]: "Estadísticas",
    [PATHS.DIAN_SYNC]: "DIAN",
    [PATHS.MY_PROFILE]: "Mi perfil",
    [PATHS.CONFIGURATION]: "Configuración",
    [PATHS.SALES_RECAUDOS]: "Recaudos",
    [PATHS.SALES_COTIZACIONES]: "Cotizaciones",
    [PATHS.SALES_COTIZACIONES_NUEVA]: "Nueva cotización",
    [PATHS.SALES_REMISIONES]: "Remisiones",
    [PATHS.SALES_PLANTILLAS]: "Plantillas",
    [PATHS.PURCHASES_SUPPLIERS]: "Proveedores",
    [PATHS.PURCHASES_COMPRAS]: "Compras",
    [PATHS.PURCHASES_GASTOS]: "Gastos",
    [PATHS.PURCHASES_PARAM]: "Parametrización",
    [PATHS.TREASURY_PAGOS]: "Pagos",
    [PATHS.TREASURY_LOTES]: "Lotes",
    [PATHS.TREASURY_BANCOS]: "Bancos",
    [PATHS.TREASURY_CONCILIACION]: "Conciliación",
    [PATHS.ACCOUNTING]: "Contabilidad",
    [PATHS.FIXED_ASSETS]: "Activos fijos",
    [PATHS.ADMIN_HOME]: "Empresas",
    [PATHS.ADMIN_PLANS]: "Planes",
    [PATHS.ADMIN_ADMINS]: "Administradores",
    [PATHS.LOGIN]: "Iniciar sesión",
    [PATHS.REGISTER]: "Registrarse",
    [PATHS.FORGOT_PASSWORD]: "Recuperar contraseña",
};

function resolveTitle(pathname: string): string | null {
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
    if (pathname.startsWith("/ventas/cotizaciones/") && pathname.endsWith("/editar")) return "Editar cotización";
    if (pathname.startsWith("/documentos/")) return "Detalle factura";
    if (pathname.startsWith("/admin/empresas/")) return "Empresa";
    if (pathname === PATHS.HOME) return "Tecnotics";
    return null;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ onOpenMenu, showMenuButton }) => {
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const { theme, toggleTheme } = useTheme();

    const isAuthPage = [PATHS.LOGIN, PATHS.REGISTER, PATHS.FORGOT_PASSWORD].includes(location.pathname);
    const isPublicHome = location.pathname === PATHS.HOME;
    const showUserMenu = Boolean(user && !isAuthPage && !isPublicHome);
    const title = resolveTitle(location.pathname);

    return (
        <header className="mobile-header">
            <div className="mobile-header__inner">
                <div className="mobile-header__left">
                    {showMenuButton ? (
                        <button
                            type="button"
                            className="mobile-header__icon-btn"
                            onClick={onOpenMenu}
                            aria-label="Abrir menú"
                        >
                            <i className="ri-menu-line" aria-hidden />
                        </button>
                    ) : (
                        <NavLink to={PATHS.HOME} className="mobile-header__brand">
                            <img src={favicon} alt="Tecnotics" />
                        </NavLink>
                    )}
                </div>

                {title && <span className="mobile-header__title">{title}</span>}

                <div className="mobile-header__right">
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
                    {showUserMenu ? (
                        <UserMenu />
                    ) : (
                        !showMenuButton && (
                            <NavLink to={PATHS.HOME} className="mobile-header__brand">
                                <img src={logo} alt="Tecnotics" />
                            </NavLink>
                        )
                    )}
                </div>
            </div>
        </header>
    );
};

export default MobileHeader;
