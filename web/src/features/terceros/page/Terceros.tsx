import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "../../purchases/page/Purchases.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getTerceros, deleteTercero, migrateTerceros, backfillTerceros } from "../terceros.service";
import type { Tercero, TerceroRole } from "../terceros.types";
import { ROLE_LABELS } from "../terceros.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import TerceroModal from "../components/TerceroModal";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    PaginationToolbar,
    paginationRange,
    FilterField,
    FiltersMobileDrawer,
    FieldControl,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
    useConfirm,
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const ROLE_BADGE: Record<TerceroRole, string> = { cliente: "status-paid", proveedor: "status-pending", empleado: "status-paid", otro: "" };

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "tercero", label: "Tercero", type: "text", icon: "ri-user-search-line", serverSide: true },
    { id: "documento", label: "NIT / Doc.", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "rol", label: "Roles", type: "select", icon: "ri-user-settings-line", options: [{ value: "cliente", label: "Cliente" }, { value: "proveedor", label: "Proveedor" }, { value: "empleado", label: "Empleado" }, { value: "otro", label: "Otro" }], serverSide: true },
    { id: "correo", label: "Correo", type: "text", icon: "ri-mail-line" },
    { id: "resp_iva", label: "Resp. IVA", type: "select", icon: "ri-check-line", options: [{ value: "si", label: "Sí" }, { value: "no", label: "No" }] },
];

const TercerosPage: React.FC = () => {
    const { confirm } = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const searchFromUrl = searchParams.get("search") ?? "";
    const rolFromUrl = searchParams.get("rol") ?? "";

    const [terceros, setTerceros] = useState<Tercero[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [filterSearch, setFilterSearch] = useState(searchFromUrl);
    const [rol, setRol] = useState(rolFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => searchFromUrl !== "" || rolFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const getRowFilterValue = useCallback((row: Tercero, filterId: string): string => {
        switch (filterId) {
            case "tercero": return row.name ?? "";
            case "documento": return `${row.doc_number ?? ""}${row.doc_number_dv ? `-${row.doc_number_dv}` : ""}`;
            case "rol": return row.roles?.join(" ") ?? "";
            case "correo": return row.email ?? "";
            case "resp_iva": return row.responsable_iva ? "si" : "no";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedTerceros = filterRows(terceros);
    const hasActiveFilters = filterSearch.trim() !== "" || rol.trim() !== "" || hasActiveClientFilters;

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Tercero | null>(null);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [linking, setLinking] = useState(false);

    const updateQueryParams = useCallback((updates: { page?: number; limit?: number; search?: string; rol?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);

            if (updates.page !== undefined) {
                params.set("page", String(Math.max(1, updates.page)));
            }
            if (updates.limit !== undefined) {
                params.set("limit", String(normalizePageSize(updates.limit)));
            }
            if (updates.search !== undefined) {
                const value = updates.search.trim();
                if (value) params.set("search", value);
                else params.delete("search");
            }
            if (updates.rol !== undefined) {
                const value = updates.rol.trim();
                if (value) params.set("rol", value);
                else params.delete("rol");
            }

            return params;
        });
    }, [setSearchParams]);

    const handleBackfill = async () => {
        if (!(await confirm("¿Vincular tus clientes, proveedores y empleados con el maestro de terceros? Es seguro y se puede repetir."))) return;
        setLinking(true);
        try {
            const res = await backfillTerceros();
            successToast(res.message);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al vincular");
        } finally {
            setLinking(false);
        }
    };

    useRealtime(RealtimeEvents.TERCERO_CHANGED, (payload) => setTerceros((prev) => applyRealtimeChange(prev, payload)));

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        if (page !== 1) {
            setPage(1);
            updateQueryParams({ page: 1 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, rol, pageSize]);

    useEffect(() => {
        const timeout = window.setTimeout(() => updateQueryParams({ search: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
    }, [debouncedSearch, updateQueryParams]);

    useEffect(() => {
        let ignore = false;
        const hasData = terceros.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);

        (async () => {
            try {
                const res = await getTerceros(page, pageSize, debouncedSearch.trim(), rol);
                if (ignore) return;
                setTerceros(res.terceros);
                setTotalPages(res.pagination.totalPages);
                setTotalItems(res.pagination.total);
            } catch (e) {
                if (!ignore) errorToast(e instanceof Error ? e.message : "Error al cargar terceros");
            } finally {
                if (!ignore) {
                    setLoading(false);
                    setIsPageFetching(false);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [page, pageSize, debouncedSearch, rol, refreshKey]);

    const handlePageChange = (nextPage: number) => {
        const safePage = Math.max(1, Math.min(totalPages, nextPage));
        setPage(safePage);
        updateQueryParams({ page: safePage });
    };

    const handlePageSizeChange = (nextSize: number) => {
        const safeSize = normalizePageSize(nextSize);
        setPageSize(safeSize);
        setPage(1);
        updateQueryParams({ page: 1, limit: safeSize });
    };

    const clearFilters = () => {
        setFilterSearch("");
        setRol("");
        updateQueryParams({ search: "", rol: "", page: 1 });
        setPage(1);
        clearColFilters();
    };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;

        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(640, window.innerWidth - 32);
        const left = Math.max(16, rect.right - width);
        const panelHeight = panel?.offsetHeight ?? 0;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const openUp = panelHeight > 0 && spaceBelow < panelHeight && rect.top > panelHeight + gap;
        const top = openUp ? rect.top - gap - panelHeight : rect.bottom + gap;

        setFiltersPanelStyle({
            position: "fixed",
            top: Math.max(8, top),
            left,
            width,
        });
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, rol]);

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

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deleteTercero(toDelete.id);
            successToast("Tercero eliminado");
            if (terceros.length === 1 && page > 1) handlePageChange(page - 1);
            else setRefreshKey((k) => k + 1);
            setToDelete(null);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    const handleMigrate = async () => {
        if (!(await confirm("¿Importar clientes y proveedores existentes al maestro de terceros? Es seguro y se puede repetir (no duplica)."))) return;
        setMigrating(true);
        try {
            const res = await migrateTerceros();
            successToast(res.message);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error en la migración");
        } finally {
            setMigrating(false);
        }
    };

    const formatDoc = (t: Tercero) => `${t.doc_number}${t.doc_number_dv ? `-${t.doc_number_dv}` : ""}`;

    const renderRoles = (t: Tercero) =>
        t.roles.map((r) => (
            <span key={r} className={`status-badge ${ROLE_BADGE[r]}`}>
                {ROLE_LABELS[r]}
            </span>
        ));

    const renderFlags = (t: Tercero) => (
        <>
            {t.gran_contribuyente && <span className="status-badge status-paid" title="Gran contribuyente">GC</span>}{" "}
            {t.autorretenedor && <span className="status-badge status-pending" title="Autorretenedor">AR</span>}
        </>
    );

    const renderActions = (t: Tercero, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            <button type="button" className="btn-action" title="Editar" onClick={() => { setEditing(t); setModalOpen(true); }}>
                <i className="ri-edit-line" aria-hidden />
                {layout === "table" ? "Editar" : null}
            </button>
            <button type="button" className="btn-action" title="Eliminar" onClick={() => setToDelete({ id: t._id, name: t.name })}>
                <i className="ri-delete-bin-line" aria-hidden />
                {layout === "table" ? "Eliminar" : null}
            </button>
        </div>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Tercero</th>
                        <th>NIT / Doc.</th>
                        <th>Roles</th>
                        <th>Correo</th>
                        <th>Resp. IVA</th>
                        <th></th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedTerceros.map((t) => (
                        <tr key={t._id}>
                            <td data-label="Tercero">
                                {t.name}
                                {t.conflicto_revision && (
                                    <span title="Revisar: posible duplicado" style={{ color: "var(--tertiary-color)", marginLeft: 6 }}>
                                        <i className="ri-error-warning-line" />
                                    </span>
                                )}
                            </td>
                            <td data-label="NIT / Doc.">{formatDoc(t)}</td>
                            <td data-label="Roles">{renderRoles(t)}</td>
                            <td data-label="Correo">{t.email || "—"}</td>
                            <td data-label="Resp. IVA">{t.responsable_iva ? "Sí" : "No"}</td>
                            <td>{renderFlags(t)}</td>
                            <td data-label="Acciones">{renderActions(t)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {displayedTerceros.map((t) => (
                <article key={t._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">
                                {t.name}
                                {t.conflicto_revision && (
                                    <span title="Revisar: posible duplicado" className="terceros-conflict-icon">
                                        <i className="ri-error-warning-line" aria-hidden />
                                    </span>
                                )}
                            </strong>
                            <div className="terceros-card-roles">{renderRoles(t)}</div>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{formatDoc(t)}</strong>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Correo</dt>
                                <dd>{t.email || "—"}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Resp. IVA</dt>
                                <dd>{t.responsable_iva ? "Sí" : "No"}</dd>
                            </div>
                            <div className="purchases-list-item__field purchases-list-item__field--full">
                                <dt>Etiquetas</dt>
                                <dd className="terceros-card-flags">{renderFlags(t) || "—"}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderActions(t, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {displayedTerceros.map((t) => (
                <article key={t._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">
                            {t.name}
                            {t.conflicto_revision && (
                                <span title="Revisar: posible duplicado" className="terceros-conflict-icon">
                                    <i className="ri-error-warning-line" aria-hidden />
                                </span>
                            )}
                        </strong>
                        <div className="terceros-card-roles">{renderRoles(t)}</div>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{formatDoc(t)}</strong>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Correo</dt>
                            <dd>{t.email || "—"}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Resp. IVA</dt>
                            <dd>{t.responsable_iva ? "Sí" : "No"}</dd>
                        </div>
                        <div className="purchases-card__field purchases-card__field--full">
                            <dt>Etiquetas</dt>
                            <dd className="terceros-card-flags">{renderFlags(t) || "—"}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">{renderActions(t, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const filterContent = (
        <>
            <FilterField label="Búsqueda" htmlFor="terceros-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="terceros-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Nombre, NIT, correo..."
                                        />
                                    </FilterField>
                                    <FilterField label="Rol" htmlFor="terceros-filter-rol" icon="ri-user-settings-line">
                                        <FieldControl
                                            as="select"
                                            id="terceros-filter-rol"
                                            value={rol}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setRol(value);
                                                if (page !== 1) setPage(1);
                                                updateQueryParams({ page: 1, rol: value });
                                            }}
                                        >
                                            <option value="">Todos los roles</option>
                                            <option value="cliente">Clientes</option>
                                            <option value="proveedor">Proveedores</option>
                                            <option value="empleado">Empleados</option>
                                        </FieldControl>
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="terceros-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="terceros-filters-heading" className="purchases-filters-panel__title">
                    Filtrar terceros
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="purchases-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="purchases-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="purchases-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="purchases-filters-clear purchases-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="purchases-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`purchases-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((value) => !value)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="terceros-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="terceros-filters-panel"
                            className="purchases-filters-panel purchases-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="terceros-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    const { start, end } = paginationRange(page, pageSize, totalItems);

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <div className="purchases-sticky-head">
                    <ListPageHeader
                        className="purchases-header"
                        title="Terceros"
                        subtitle="Maestro unificado de clientes, proveedores y empleados con sus datos fiscales"
                        actions={
                            <>
                                <button type="button" className="btn-secondary" onClick={handleMigrate} disabled={migrating} title="Importar clientes y proveedores existentes">
                                    <i className="ri-refresh-line" aria-hidden /> {migrating ? "Importando..." : "Importar existentes"}
                                </button>
                                <button type="button" className="btn-secondary" onClick={handleBackfill} disabled={linking} title="Vincular clientes/proveedores/empleados con su tercero canónico">
                                    <i className="ri-links-line" aria-hidden /> {linking ? "Vinculando..." : "Vincular IDs"}
                                </button>
                                <button type="button" className="btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
                                    <i className="ri-add-line" aria-hidden /> Nuevo tercero
                                </button>
                            </>
                        }
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar terceros"
    ariaLabelledBy="terceros-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                <PaginationToolbar
                    position="top"
                    page={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    rangeStart={start}
                    rangeEnd={end}
                    isFetching={isPageFetching || loading}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showViewToggle
                    beforeViewToggle={filtersToolbar}
                    emptyLabel={totalItems === 0 ? "Sin terceros" : undefined}
                />

                {loading ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                        Cargando terceros...
                    </div>
                ) : terceros.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-contacts-book-line" />
                        <p>No hay terceros. Crea uno nuevo o importa tus clientes y proveedores existentes.</p>
                        <button className="btn-primary" onClick={handleMigrate} disabled={migrating}>
                            <i className="ri-refresh-line" /> Importar existentes
                        </button>
                    </div>
                ) : (
                    <>
                        {renderView()}
                        <PaginationToolbar
                            position="bottom"
                            page={page}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            rangeStart={start}
                            rangeEnd={end}
                            onPageChange={handlePageChange}
                            isFetching={isPageFetching}
                            emptyLabel={totalItems === 0 ? "Sin terceros" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            <TerceroModal
                isOpen={modalOpen}
                tercero={editing}
                onClose={() => { setModalOpen(false); setEditing(null); }}
                onSaved={() => { setModalOpen(false); setEditing(null); setRefreshKey((k) => k + 1); }}
            />
            <ConfirmModal isOpen={!!toDelete} title="Eliminar tercero" message={`¿Eliminar a "${toDelete?.name}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={handleDelete} loading={deleting} />
        </ListPageShell>
    );
};

export default TercerosPage;
