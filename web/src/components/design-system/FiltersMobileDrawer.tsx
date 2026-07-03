import type { ReactNode } from "react";
import { AppDrawer } from "./AppModal";

type FiltersMobileDrawerProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    titleIcon?: string;
    hasActiveFilters?: boolean;
    onClear?: () => void;
    children: ReactNode;
    ariaLabelledBy?: string;
};

/** Drawer lateral móvil para paneles de filtros (design system). */
export function FiltersMobileDrawer({
    open,
    onClose,
    title,
    titleIcon = "ri-filter-3-line",
    hasActiveFilters = false,
    onClear,
    children,
    ariaLabelledBy,
}: FiltersMobileDrawerProps) {
    if (!open) return null;

    return (
        <AppDrawer
            title={title}
            titleIcon={titleIcon}
            onClose={onClose}
            ariaLabelledBy={ariaLabelledBy}
            footer={
                <>
                    {hasActiveFilters && onClear && (
                        <button type="button" className="export-cancel" onClick={onClear}>
                            Limpiar
                        </button>
                    )}
                    <button type="button" className="export-submit" onClick={onClose}>
                        Aplicar filtros
                    </button>
                </>
            }
        >
            <div className="purchases-filters-grid ds-filters-drawer__grid">{children}</div>
        </AppDrawer>
    );
}
