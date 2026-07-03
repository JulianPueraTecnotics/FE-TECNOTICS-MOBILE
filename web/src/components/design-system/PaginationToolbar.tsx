import type { ReactNode } from "react";
import { ViewModeToggle, type ViewMode } from "./ViewModeToggle";
import { useIsMobile } from "./useListViewMode";

const DEFAULT_PAGE_SIZES = [5, 10, 20, 50, 100] as const;

export type PaginationToolbarProps = {
    position?: "top" | "bottom";
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    pageSizeOptions?: readonly number[];
    rangeStart: number;
    rangeEnd: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    isFetching?: boolean;
    emptyLabel?: string;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    showViewToggle?: boolean;
    extraActions?: ReactNode;
    beforeViewToggle?: ReactNode;
};

export function PaginationToolbar({
    position = "top",
    page,
    totalPages,
    totalItems,
    pageSize,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    rangeStart,
    rangeEnd,
    onPageChange,
    onPageSizeChange,
    isFetching = false,
    emptyLabel,
    viewMode,
    onViewModeChange,
    showViewToggle = false,
    extraActions,
    beforeViewToggle,
}: PaginationToolbarProps) {
    const isMobile = useIsMobile();
    if (totalItems === 0 && !emptyLabel) return null;
    const showPageControls = totalPages > 1;

    const pageSizeControl = position === "top" && onPageSizeChange && (
        <div className="ds-page-size documents-page-size">
            <label htmlFor={`ds-page-size-${position}`}>Por página</label>
            <select
                id={`ds-page-size-${position}`}
                className="ds-page-size__select documents-page-size__select"
                value={pageSize}
                disabled={isFetching}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
                {pageSizeOptions.map((n) => (
                    <option key={n} value={n}>
                        {n}
                    </option>
                ))}
            </select>
        </div>
    );

    const paginationControls = showPageControls && (
        <div className="ds-pagination-controls documents-pagination-controls">
            <button
                type="button"
                className="ds-pagination-btn documents-pagination-btn"
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1 || isFetching}
                aria-label="Página anterior"
            >
                <i className="ri-arrow-left-s-line" aria-hidden />
            </button>
            <span className="ds-pagination-indicator documents-pagination-indicator">
                <span className="ds-pagination-indicator__current documents-pagination-indicator__current">
                    {page}
                </span>
                <span className="documents-pagination-indicator__sep">/</span>
                <span className="documents-pagination-indicator__total">{totalPages}</span>
            </span>
            <button
                type="button"
                className="ds-pagination-btn documents-pagination-btn"
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages || isFetching}
                aria-label="Página siguiente"
            >
                <i className="ri-arrow-right-s-line" aria-hidden />
            </button>
        </div>
    );

    return (
        <div className={`ds-toolbar documents-toolbar documents-toolbar--${position}`}>
            <div className="ds-pagination-meta documents-pagination-meta">
                <span className="ds-pagination-range documents-pagination-range">
                    {totalItems > 0 ? (
                        <>
                            Mostrando <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> de{" "}
                            <strong>{totalItems}</strong>
                        </>
                    ) : (
                        emptyLabel ?? "Sin registros"
                    )}
                    {isFetching ? " · Actualizando…" : ""}
                </span>
                {position === "top" && (pageSizeControl || paginationControls) && (
                    <div className="ds-toolbar__pagination-row">
                        {pageSizeControl}
                        {paginationControls}
                    </div>
                )}
            </div>

            <div className="ds-toolbar__actions documents-toolbar__actions">
                {extraActions}
                {position === "bottom" && paginationControls}
                {position === "top" && beforeViewToggle}
                {position === "top" && showViewToggle && viewMode && onViewModeChange && !isMobile && (
                    <ViewModeToggle value={viewMode} onChange={onViewModeChange} disabled={isFetching} />
                )}
            </div>
        </div>
    );
}
