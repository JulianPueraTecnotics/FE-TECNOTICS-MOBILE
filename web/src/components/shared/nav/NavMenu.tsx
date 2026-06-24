import { useContext, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AuthContext } from "../../../store/auth.context";
import {
    COMPANY_MENU,
    filterMenuByRole,
    isGroupActive,
    type MenuItem,
} from "./menu.config";
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

    // Grupos abiertos por el usuario. El grupo de la ruta activa se considera abierto
    // aunque no esté en el set (ver `isOpen`).
    const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        items.forEach((it) => {
            if (it.children && isGroupActive(it, location.pathname)) initial.add(it.label);
        });
        return initial;
    });

    const toggleGroup = (label: string) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });
    };

    const renderLink = (item: MenuItem, isChild: boolean) => (
        <NavLink
            to={item.path!}
            end={item.path === "/dashboard"}
            className={`${variant}__menu-link${isChild ? ` ${variant}__menu-link--child` : ""}`}
            onClick={onNavigate}
        >
            {item.icon && <i className={item.icon} aria-hidden></i>}
            <span>{item.label}</span>
            {item.comingSoon && <span className={`${variant}__menu-badge`}>Pronto</span>}
        </NavLink>
    );

    return (
        <ul className={`${variant}__menu`}>
            {items.map((item) => {
                if (!item.children) {
                    return (
                        <li key={item.label} className={`${variant}__menu-item`}>
                            {renderLink(item, false)}
                        </li>
                    );
                }

                const open = openGroups.has(item.label) || isGroupActive(item, location.pathname);
                return (
                    <li key={item.label} className={`${variant}__menu-item ${variant}__menu-group`}>
                        <button
                            type="button"
                            className={`${variant}__menu-link ${variant}__menu-group-toggle`}
                            aria-expanded={open}
                            onClick={() => toggleGroup(item.label)}
                        >
                            {item.icon && <i className={item.icon} aria-hidden></i>}
                            <span>{item.label}</span>
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
