import { useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AuthContext } from "../../../store/auth.context";
import {
    COMPANY_MENU,
    filterMenuByRole,
    isGroupActive,
    type MenuItem,
} from "./menu.config";
import { PATHS } from "../../../router/paths.contants";
import "./NavMenu.css";

interface NavMenuProps {
    /**
     * Prefijo de clases CSS del contenedor que lo usa ("sidebar" | "header"),
     * para reusar los estilos existentes de cada barra.
     */
    variant: "sidebar" | "header";
    /** Callback al navegar (p. ej. cerrar el sidebar en móvil). */
    onNavigate?: () => void;
}

/**
 * Renderiza el menú de empresa a partir de COMPANY_MENU (fuente única).
 * Items con `children` se muestran como acordeón expandible; el grupo que contiene
 * la ruta activa se auto-expande. Sustituye las dos listas de enlaces duplicadas
 * que antes vivían a mano en Navbar.tsx y Siderbar.tsx.
 */
const NavMenu: React.FC<NavMenuProps> = ({ variant, onNavigate }) => {
    const { user } = useContext(AuthContext);
    const location = useLocation();
    const items = filterMenuByRole(COMPANY_MENU, user?.role ?? null);
    const menuRef = useRef<HTMLUListElement>(null);

    const grupoActivoPorRuta = () =>
        items.find((it) => it.children && isGroupActive(it, location.pathname))?.label ?? null;

    // Acordeón: solo un grupo abierto a la vez.
    const [openGroup, setOpenGroup] = useState<string | null>(() => grupoActivoPorRuta());
    /** Grupo fijado por clic en desktop (no se cierra al salir con el mouse). */
    const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);

    const isHeaderDesktop = () =>
        variant === "header" && window.matchMedia("(min-width: 768px)").matches;

    // Al navegar, abrir el grupo que contiene la ruta activa.
    useEffect(() => {
        const activo = grupoActivoPorRuta();
        if (activo) setOpenGroup(activo);
    }, [location.pathname, location.search, user?.role]);

    const toggleGroup = (label: string) => {
        if (isHeaderDesktop()) {
            if (openGroup === label && pinnedGroup === label) {
                setOpenGroup(grupoActivoPorRuta());
                setPinnedGroup(null);
                return;
            }
            setOpenGroup(label);
            setPinnedGroup(label);
            return;
        }
        setPinnedGroup(null);
        setOpenGroup((prev) => (prev === label ? null : label));
    };

    const openGroupOnHover = (label: string) => {
        if (isHeaderDesktop()) setOpenGroup(label);
    };

    const closeGroupOnHover = () => {
        if (!isHeaderDesktop()) return;
        if (pinnedGroup) {
            setOpenGroup(pinnedGroup);
            return;
        }
        setOpenGroup(grupoActivoPorRuta());
    };

    // Cerrar submenú fijado por clic al hacer clic fuera del menú.
    useEffect(() => {
        if (variant !== "header" || !pinnedGroup) return;
        const onDocMouseDown = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) {
                setPinnedGroup(null);
                setOpenGroup(grupoActivoPorRuta());
            }
        };
        document.addEventListener("mousedown", onDocMouseDown);
        return () => document.removeEventListener("mousedown", onDocMouseDown);
    }, [pinnedGroup, variant, location.pathname, location.search, user?.role]);

    // Algunos items comparten la MISMA ruta base y solo difieren en el query `?sec=` (ej. todas
    // las secciones de Contabilidad apuntan a PATHS.ACCOUNTING). NavLink decide `active` solo por
    // pathname e ignora el query, por lo que TODAS se resaltarían a la vez. Para esos casos
    // calculamos el estado activo comparando también el `sec` actual de la URL.
    const handleNavigate = () => {
        if (variant === "header") {
            setPinnedGroup(null);
            setOpenGroup(grupoActivoPorRuta());
        }
        onNavigate?.();
    };

    const linkActivo = (path: string): boolean => {
        const [base, query] = path.split("?");
        if (base !== location.pathname) return false;
        if (!query) return true;
        const secEsperado = new URLSearchParams(query).get("sec");
        const secActual = new URLSearchParams(location.search).get("sec");
        return secEsperado === secActual;
    };

    const itemLabel = (item: MenuItem, isChild: boolean) =>
        !isChild && variant === "header" ? (item.shortLabel ?? item.label) : item.label;

    const renderLink = (item: MenuItem, isChild: boolean) => {
        const tieneQuery = item.path!.includes("?");
        const baseClass = `${variant}__menu-link${isChild ? ` ${variant}__menu-link--child` : ""}`;
        const label = itemLabel(item, isChild);
        const contenido = (
            <>
                {item.icon && <i className={item.icon} aria-hidden></i>}
                <span title={!isChild && variant === "header" && item.shortLabel ? item.label : undefined}>{label}</span>
                {item.comingSoon && <span className={`${variant}__menu-badge`}>Pronto</span>}
            </>
        );
        // Rutas que comparten pathname y difieren solo en `?sec=`: NavLink marcaría `active` a TODAS
        // (decide por pathname e ignora el query). Usamos Link normal y controlamos `active` nosotros.
        if (tieneQuery) {
            return (
                <Link to={item.path!} className={`${baseClass}${linkActivo(item.path!) ? " active" : ""}`} onClick={handleNavigate}>
                    {contenido}
                </Link>
            );
        }
        // `end` (match exacto) en rutas que son prefijo de otra (ej. /facturar vs /facturar/pos),
        // para no resaltar la padre cuando estamos en la hija.
        return (
            <NavLink to={item.path!} end={item.path === "/dashboard" || item.path === PATHS.DASHBOARD_BILLING} className={baseClass} onClick={handleNavigate}>
                {contenido}
            </NavLink>
        );
    };

    return (
        <ul ref={menuRef} className={`${variant}__menu`}>
            {items.map((item) => {
                if (!item.children) {
                    return (
                        <li key={item.label} className={`${variant}__menu-item`}>
                            {renderLink(item, false)}
                        </li>
                    );
                }

                const groupActive = isGroupActive(item, location.pathname);
                const open = openGroup === item.label;
                return (
                    <li
                        key={item.label}
                        className={`${variant}__menu-item ${variant}__menu-group${groupActive ? " is-active" : ""}${open ? " is-open" : ""}`}
                        onMouseEnter={() => openGroupOnHover(item.label)}
                        onMouseLeave={closeGroupOnHover}
                    >
                        <button
                            type="button"
                            className={`${variant}__menu-link ${variant}__menu-group-toggle`}
                            aria-expanded={open}
                            onClick={() => toggleGroup(item.label)}
                        >
                            {item.icon && <i className={item.icon} aria-hidden></i>}
                            <span title={variant === "header" && item.shortLabel ? item.label : undefined}>
                                {itemLabel(item, false)}
                            </span>
                            <i
                                className={`ri-arrow-down-s-line ${variant}__menu-caret${open ? " is-open" : ""}`}
                                aria-hidden
                            ></i>
                        </button>
                        {open && (
                            <ul className={`${variant}__submenu`}>
                                {item.children.map((child) => (
                                    <li key={child.label} className={`${variant}__submenu-item`}>
                                        {renderLink(child, true)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

export default NavMenu;
