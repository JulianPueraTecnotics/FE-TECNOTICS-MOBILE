import { NavLink, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../store/auth.context";
import { PATHS } from "../../router/paths.contants";
import "./mobile-shell.css";

interface MobileBottomNavProps {
    onOpenMenu: () => void;
}

const VENTAS_PREFIXES = [
    PATHS.DOCUMENTS,
    PATHS.SALES_RECAUDOS,
    PATHS.SALES_COTIZACIONES,
    PATHS.SALES_COTIZACIONES_NUEVA,
    PATHS.SALES_REMISIONES,
    PATHS.SALES_PLANTILLAS,
    PATHS.CLIENTS,
];

const COMPRAS_PREFIXES = [
    PATHS.PURCHASES,
    PATHS.PURCHASES_SUPPLIERS,
    PATHS.PURCHASES_COMPRAS,
    PATHS.PURCHASES_GASTOS,
    PATHS.PURCHASES_PARAM,
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
    return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const pathname = location.pathname;
    const isSuperAdmin = user?.role === "super_admin";

    if (isSuperAdmin) {
        return (
            <nav className="mobile-bottom-nav" aria-label="Navegación admin">
                <NavLink to={PATHS.ADMIN_HOME} end className="mobile-bottom-nav__item">
                    <i className="ri-building-line" aria-hidden />
                    <span>Empresas</span>
                </NavLink>
                <NavLink to={PATHS.ADMIN_PLANS} className="mobile-bottom-nav__item">
                    <i className="ri-price-tag-3-line" aria-hidden />
                    <span>Planes</span>
                </NavLink>
                <NavLink to={PATHS.ADMIN_ADMINS} className="mobile-bottom-nav__item">
                    <i className="ri-shield-user-line" aria-hidden />
                    <span>Admins</span>
                </NavLink>
                <button type="button" className="mobile-bottom-nav__item" onClick={onOpenMenu}>
                    <i className="ri-menu-line" aria-hidden />
                    <span>Menú</span>
                </button>
            </nav>
        );
    }

    const ventasActive = matchesPrefix(pathname, VENTAS_PREFIXES) || pathname.startsWith("/ventas/cotizaciones/");
    const comprasActive = matchesPrefix(pathname, COMPRAS_PREFIXES);

    return (
        <nav className="mobile-bottom-nav" aria-label="Navegación principal">
            <NavLink
                to={PATHS.DASHBOARD}
                end
                className={({ isActive }) =>
                    `mobile-bottom-nav__item${isActive ? " active" : ""}`
                }
            >
                <i className="ri-home-5-line" aria-hidden />
                <span>Inicio</span>
            </NavLink>
            <NavLink
                to={PATHS.DOCUMENTS}
                className={() =>
                    `mobile-bottom-nav__item${ventasActive ? " active" : ""}`
                }
            >
                <i className="ri-shopping-cart-2-line" aria-hidden />
                <span>Ventas</span>
            </NavLink>
            <NavLink
                to={PATHS.PURCHASES_COMPRAS}
                className={() =>
                    `mobile-bottom-nav__item${comprasActive ? " active" : ""}`
                }
            >
                <i className="ri-shopping-bag-3-line" aria-hidden />
                <span>Compras</span>
            </NavLink>
            <NavLink
                to={PATHS.ACCOUNTING}
                className={({ isActive }) =>
                    `mobile-bottom-nav__item${isActive || pathname.startsWith(PATHS.FIXED_ASSETS) ? " active" : ""}`
                }
            >
                <i className="ri-book-2-line" aria-hidden />
                <span>Contab.</span>
            </NavLink>
            <button
                type="button"
                className="mobile-bottom-nav__item"
                onClick={onOpenMenu}
                aria-label="Abrir menú completo"
            >
                <i className="ri-menu-line" aria-hidden />
                <span>Más</span>
            </button>
        </nav>
    );
};

export default MobileBottomNav;
