import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FiltersMobileDrawer } from "./FiltersMobileDrawer";

type UseListFiltersPanelOptions = {
    panelId: string;
    title: string;
    hasActiveFilters: boolean;
    onClear: () => void;
    filterContent: ReactNode;
    /** Values that change panel height — triggers reposition. */
    repositionDeps?: unknown[];
    /** CSS prefix for toggle/panel classes (default: purchases) */
    variant?: "purchases" | "clients" | "documents";
};

const VARIANT_PREFIX = {
    purchases: "purchases",
    clients: "clients",
    documents: "documents",
} as const;

export function useListFiltersPanel({
    panelId,
    title,
    hasActiveFilters,
    onClear,
    filterContent,
    repositionDeps = [],
    variant = "purchases",
}: UseListFiltersPanelOptions) {
    const prefix = VARIANT_PREFIX[variant];
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;

        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(560, window.innerWidth - 32);
        const left = Math.max(16, rect.right - width);
        const panelHeight = panel?.offsetHeight ?? 0;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const openUp = panelHeight > 0 && spaceBelow < panelHeight && rect.top > panelHeight + gap;
        const top = openUp ? rect.top - gap - panelHeight : rect.bottom + gap;

        setFiltersPanelStyle({ position: "fixed", top: Math.max(8, top), left, width });
    }, []);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const sync = () => setIsMobile(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    useLayoutEffect(() => {
        if (!filtersOpen || isMobile) return;
        updateFiltersPanelPosition();
        const frame = requestAnimationFrame(updateFiltersPanelPosition);
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, ...repositionDeps]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onReflow = () => updateFiltersPanelPosition();
        window.addEventListener("resize", onReflow);
        window.addEventListener("scroll", onReflow, true);
        return () => {
            window.removeEventListener("resize", onReflow);
            window.removeEventListener("scroll", onReflow, true);
        };
    }, [filtersOpen, isMobile, updateFiltersPanelPosition]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onPointer = (e: MouseEvent) => {
            const target = e.target as Node;
            if (filtersDropdownRef.current?.contains(target) || filtersPanelRef.current?.contains(target)) return;
            setFiltersOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [filtersOpen, isMobile]);

    useEffect(() => {
        if (!filtersOpen || !isMobile) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [filtersOpen, isMobile]);

    const filtersPanelContent = (
        <>
            <div className={`${prefix}-filters-panel__head`}>
                <h2 id={`${panelId}-filters-heading`} className={`${prefix}-filters-panel__title`}>
                    {title}
                </h2>
                {hasActiveFilters && (
                    <button type="button" className={`${prefix}-filters-clear`} onClick={onClear}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className={`${prefix}-filters-grid`}>{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className={`${prefix}-filters-toolbar`}>
            {hasActiveFilters && (
                <button type="button" className={`${prefix}-filters-clear ${prefix}-filters-clear--inline`} onClick={onClear}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className={`${prefix}-filters-dropdown`} ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`${prefix}-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls={`${panelId}-filters-panel`}
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className={`${prefix}-filters-badge`} aria-hidden />}
                    <i className={`ri-arrow-down-s-line ${prefix}-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id={`${panelId}-filters-panel`}
                            className={`${prefix}-filters-panel ${prefix}-filters-panel--floating`}
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby={`${panelId}-filters-heading`}
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    const filtersMobileDrawer = (
        <FiltersMobileDrawer
            open={filtersOpen && isMobile}
            onClose={() => setFiltersOpen(false)}
            title={title}
            ariaLabelledBy={`${panelId}-filters-heading-mobile`}
            hasActiveFilters={hasActiveFilters}
            onClear={onClear}
        >
            {filterContent}
        </FiltersMobileDrawer>
    );

    return { filtersToolbar, filtersMobileDrawer, filtersOpen, setFiltersOpen };
}
