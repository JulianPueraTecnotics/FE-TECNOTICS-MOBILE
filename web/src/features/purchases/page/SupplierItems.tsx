import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "./Purchases.css";
import "../components/PurchaseModals.css";
import "../../ledger/page/Accounting.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getSupplierItems, suggestSupplierItem, applySupplierItemSuggestion, parametrizeSupplierItem, type SupplierItem } from "../supplierItems.service";
import LearningPanel from "../components/LearningPanel";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
    AppModal,
    FieldControl,
    FilterField,
    FiltersMobileDrawer,
    ListPageContainer,
    ListPageHeader,
    ListPageShell,
    PaginationToolbar,
    paginationRange,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const acc = (p?: { niif?: string; colgaap?: string }) => p?.niif || p?.colgaap || "?";

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "producto", label: "Producto", type: "text", icon: "ri-price-tag-3-line", serverSide: true },
    { id: "nit", label: "NIT prov.", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "gasto", label: "Gasto", type: "text", icon: "ri-money-dollar-circle-line" },
    { id: "cxp", label: "CxP", type: "text", icon: "ri-bank-card-line" },
    { id: "retef", label: "Retef.", type: "text", icon: "ri-percent-line" },
    { id: "estado", label: "Estado", type: "select", icon: "ri-filter-3-line", options: [{ value: "PARAMETRIZADO", label: "Parametrizado" }, { value: "NO_PARAMETRIZADO", label: "Pendiente" }], serverSide: true },
    { id: "ia", label: "IA", type: "text", icon: "ri-sparkling-line" },
];

const SupplierItemsPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const searchFromUrl = searchParams.get("search") ?? "";
    const statusFromUrl = searchParams.get("status") ?? "";

    const [items, setItems] = useState<SupplierItem[]>([]);
    const [pendientes, setPendientes] = useState(0);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [filterSearch, setFilterSearch] = useState(searchFromUrl);
    const [statusFilter, setStatusFilter] = useState(statusFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => statusFromUrl !== "" || searchFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);

    const [editing, setEditing] = useState<SupplierItem | null>(null);
    const [form, setForm] = useState({ gasto: "", cxp: "", iva: "", retefuente_cta: "", retefuente: "", categoria: "" });
    const [saving, setSaving] = useState(false);
    const [fromAi, setFromAi] = useState(false);
    const [learningOpen, setLearningOpen] = useState(false);

    const getRowFilterValue = useCallback((row: SupplierItem, filterId: string): string => {
        switch (filterId) {
            case "producto": return `${row.codigo ?? ""} ${row.descripcion ?? ""}`.trim();
            case "nit": return row.supplier_doc ?? "";
            case "gasto": return acc(row.params?.cuenta_gasto_costo);
            case "cxp": return acc(row.params?.cuenta_por_pagar);
            case "retef": return row.params?.retefuente ? `${row.params.retefuente}` : "";
            case "estado": return row.status ?? "";
            case "ia": return row.ai_suggestion?.confianza ?? row.ai_error ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedItems = filterRows(items);
    const hasActiveFilters = statusFilter.trim() !== "" || filterSearch.trim() !== "" || hasActiveClientFilters;

    const updateQueryParams = useCallback((updates: { page?: number; limit?: number; search?: string; status?: string }) => {
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
            if (updates.status !== undefined) {
                const value = updates.status.trim();
                if (value) params.set("status", value);
                else params.delete("status");
            }

            return params;
        });
    }, [setSearchParams]);

    useEffect(() => {
        updateQueryParams({ search: debouncedSearch });
    }, [debouncedSearch, updateQueryParams]);

    useEffect(() => {
        let ignore = false;

        (async () => {
            const hasData = items.length > 0;
            if (hasData) setIsPageFetching(true);
            else setLoading(true);

            try {
                const res = await getSupplierItems({
                    search: debouncedSearch.trim(),
                    status: statusFilter,
                    page,
                    limit: pageSize,
                });
                if (ignore) return;
                setItems(res.items);
                setPendientes(res.pendientes);
                setAiEnabled(res.ai_enabled);
                setTotalPages(res.pagination.totalPages || 1);
                setTotalItems(res.pagination.total || 0);
            } catch (e) {
                if (!ignore) errorToast(e instanceof Error ? e.message : "Error al cargar");
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
    }, [debouncedSearch, statusFilter, page, pageSize, refreshKey, items.length]);

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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, statusFilter, filterSearch]);

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
        setStatusFilter("");
        setFilterSearch("");
        setPage(1);
        updateQueryParams({ page: 1, search: "", status: "" });
        clearColFilters();
    };

    const suggest = async (it: SupplierItem) => {
        setBusyId(it._id);
        try {
            await suggestSupplierItem(it._id);
            successToast("Sugerencia generada");
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    const applyAi = async (it: SupplierItem) => {
        setBusyId(it._id);
        try {
            const res = await applySupplierItemSuggestion(it._id);
            successToast(res.message || "Sugerencia aplicada");
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    const openEdit = (it: SupplierItem) => {
        setEditing(it);
        setFromAi(false);
        setForm({
            gasto: it.params?.cuenta_gasto_costo?.niif ?? "",
            cxp: it.params?.cuenta_por_pagar?.niif ?? "",
            iva: it.params?.cuenta_iva?.niif ?? "",
            retefuente_cta: it.params?.cuenta_retefuente?.niif ?? "",
            retefuente: it.params?.retefuente != null ? String(it.params.retefuente) : "",
            categoria: it.params?.retencion_categoria ?? "",
        });
    };

    const openEditFromAi = (it: SupplierItem) => {
        const s = it.ai_suggestion;
        setEditing(it);
        setFromAi(true);
        setForm({
            gasto: s?.cuenta_gasto_costo?.codigo ?? it.params?.cuenta_gasto_costo?.niif ?? "",
            cxp: s?.cuenta_por_pagar?.codigo ?? it.params?.cuenta_por_pagar?.niif ?? "",
            iva: s?.cuenta_iva?.codigo ?? it.params?.cuenta_iva?.niif ?? "",
            retefuente_cta: s?.cuenta_retefuente?.codigo ?? it.params?.cuenta_retefuente?.niif ?? "",
            retefuente: s?.retefuente_porcentaje != null ? String(s.retefuente_porcentaje) : "",
            categoria: s?.retencion_categoria ?? it.params?.retencion_categoria ?? "",
        });
    };

    const saveManual = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            await parametrizeSupplierItem(editing._id, {
                cuenta_gasto_costo: form.gasto ? { niif: form.gasto, colgaap: form.gasto } : undefined,
                cuenta_por_pagar: form.cxp ? { niif: form.cxp, colgaap: form.cxp } : undefined,
                cuenta_iva: form.iva ? { niif: form.iva, colgaap: form.iva } : undefined,
                cuenta_retefuente: form.retefuente_cta ? { niif: form.retefuente_cta, colgaap: form.retefuente_cta } : undefined,
                retefuente: Number(form.retefuente) || 0,
                retencion_categoria: form.categoria || null,
            });
            successToast(fromAi ? "Aplicado. La IA aprenderá de tu confirmación." : "Parametrización guardada");
            setEditing(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSaving(false);
        }
    };

    const renderCell = (appliedVal: string, suggVal?: string) => {
        if (appliedVal && appliedVal !== "?") return <span>{appliedVal}</span>;
        if (suggVal && suggVal !== "?") {
            return (
                <span title="Sugerido por IA (sin aplicar)" style={{ color: "var(--accent-teal)", fontStyle: "italic", opacity: 0.85 }}>
                    {suggVal}
                </span>
            );
        }
        return "?";
    };

    const renderAiBadge = (it: SupplierItem, applied: boolean) => {
        const suggestion = it.ai_suggestion;
        if (suggestion) {
            return (
                <span
                    title={`${suggestion.razonamiento ?? ""} (confianza ${suggestion.confianza ?? "?"})`}
                    className={`status-badge ${applied ? "status-paid" : "status-pending"}`}
                >
                    <i className="ri-sparkling-line" aria-hidden /> {suggestion.confianza ?? "ok"}
                </span>
            );
        }
        if (it.ai_error) {
            return (
                <span className="status-badge status-pending" title={it.ai_error}>
                    error
                </span>
            );
        }
        return "?";
    };

    const renderActions = (it: SupplierItem, layout: "table" | "list" | "cards" = "table") => {
        const busy = busyId === it._id;
        const hasAi = !!it.ai_suggestion;

        return (
            <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
                {aiEnabled && !hasAi && (
                    <button type="button" className="btn-icon" title="Sugerir con IA" onClick={() => suggest(it)} disabled={busy}>
                        <i className={busy ? "ri-loader-4-line rotating" : "ri-sparkling-2-line"} aria-hidden />
                    </button>
                )}
                {hasAi && (
                    <button
                        type="button"
                        className="btn-icon"
                        title="Revisar y aplicar sugerencia IA"
                        onClick={() => openEditFromAi(it)}
                        disabled={busy}
                        style={{ color: "var(--accent-teal)", borderColor: "var(--accent-teal)" }}
                    >
                        <i className="ri-magic-line" aria-hidden />
                    </button>
                )}
                {hasAi && (
                    <button type="button" className="btn-icon" title="Aplicar sugerencia IA tal cual" onClick={() => applyAi(it)} disabled={busy}>
                        <i className={busy ? "ri-loader-4-line rotating" : "ri-check-double-line"} aria-hidden />
                    </button>
                )}
                <button type="button" className="btn-icon" title="Parametrizar manualmente" onClick={() => openEdit(it)} disabled={busy}>
                    <i className="ri-edit-line" aria-hidden />
                </button>
            </div>
        );
    };

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>NIT prov.</th>
                        <th>Gasto</th>
                        <th>CxP</th>
                        <th>Retef.</th>
                        <th>Estado</th>
                        <th>IA</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedItems.map((it) => {
                        const suggestion = it.ai_suggestion;
                        const applied = it.status === "PARAMETRIZADO";
                        return (
                            <tr key={it._id}>
                                <td data-label="Producto">
                                    <strong>{it.codigo}</strong>
                                    <br />
                                    <span style={{ color: "var(--text-muted)", fontSize: ".82rem" }}>{it.descripcion}</span>
                                </td>
                                <td data-label="NIT prov.">{it.supplier_doc}</td>
                                <td data-label="Gasto">{renderCell(acc(it.params?.cuenta_gasto_costo), suggestion?.cuenta_gasto_costo?.codigo)}</td>
                                <td data-label="CxP">{renderCell(acc(it.params?.cuenta_por_pagar), suggestion?.cuenta_por_pagar?.codigo)}</td>
                                <td data-label="Retef.">
                                    {renderCell(
                                        it.params?.retefuente ? `${it.params.retefuente}%` : "?",
                                        suggestion?.cuenta_retefuente?.codigo
                                            ? `${suggestion.cuenta_retefuente.codigo} (${suggestion.retefuente_porcentaje ?? 0}%)`
                                            : undefined,
                                    )}
                                </td>
                                <td data-label="Estado">
                                    <span className={`status-badge ${applied ? "status-paid" : "status-pending"}`}>
                                        {applied ? "Parametrizado" : "Pendiente"}
                                    </span>
                                </td>
                                <td data-label="IA">{renderAiBadge(it, applied)}</td>
                                <td data-label="Acciones">{renderActions(it)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {displayedItems.map((it) => {
                const suggestion = it.ai_suggestion;
                const applied = it.status === "PARAMETRIZADO";
                return (
                    <article key={it._id} className="purchases-list-item">
                        <div className="purchases-list-item__body">
                            <div className="purchases-list-item__head">
                                <div>
                                    <strong className="purchases-list-item__title">{it.codigo}</strong>
                                    <p className="purchases-list-item__subtitle">{it.descripcion}</p>
                                </div>
                                <span className={`status-badge ${applied ? "status-paid" : "status-pending"}`}>
                                    {applied ? "Parametrizado" : "Pendiente"}
                                </span>
                            </div>
                            <div className="purchases-list-item__sub">
                                <strong>NIT {it.supplier_doc}</strong>
                            </div>
                            <dl className="purchases-list-item__fields">
                                <div className="purchases-list-item__field">
                                    <dt>Gasto</dt>
                                    <dd>{renderCell(acc(it.params?.cuenta_gasto_costo), suggestion?.cuenta_gasto_costo?.codigo)}</dd>
                                </div>
                                <div className="purchases-list-item__field">
                                    <dt>CxP</dt>
                                    <dd>{renderCell(acc(it.params?.cuenta_por_pagar), suggestion?.cuenta_por_pagar?.codigo)}</dd>
                                </div>
                                <div className="purchases-list-item__field">
                                    <dt>Retef.</dt>
                                    <dd>
                                        {renderCell(
                                            it.params?.retefuente ? `${it.params.retefuente}%` : "?",
                                            suggestion?.cuenta_retefuente?.codigo
                                                ? `${suggestion.cuenta_retefuente.codigo} (${suggestion.retefuente_porcentaje ?? 0}%)`
                                                : undefined,
                                        )}
                                    </dd>
                                </div>
                                <div className="purchases-list-item__field">
                                    <dt>IA</dt>
                                    <dd>{renderAiBadge(it, applied)}</dd>
                                </div>
                            </dl>
                        </div>
                        <footer className="purchases-list-item__actions">{renderActions(it, "list")}</footer>
                    </article>
                );
            })}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {displayedItems.map((it) => {
                const suggestion = it.ai_suggestion;
                const applied = it.status === "PARAMETRIZADO";
                return (
                    <article key={it._id} className="purchases-card">
                        <div className="purchases-card__header">
                            <div>
                                <strong className="purchases-card__title">{it.codigo}</strong>
                                <p className="purchases-card__subtitle">{it.descripcion}</p>
                            </div>
                            <span className={`status-badge ${applied ? "status-paid" : "status-pending"}`}>
                                {applied ? "Parametrizado" : "Pendiente"}
                            </span>
                        </div>
                        <div className="purchases-card__sub">
                            <strong>NIT {it.supplier_doc}</strong>
                        </div>
                        <dl className="purchases-card__fields purchases-card__fields--grid">
                            <div className="purchases-card__field">
                                <dt>Gasto</dt>
                                <dd>{renderCell(acc(it.params?.cuenta_gasto_costo), suggestion?.cuenta_gasto_costo?.codigo)}</dd>
                            </div>
                            <div className="purchases-card__field">
                                <dt>CxP</dt>
                                <dd>{renderCell(acc(it.params?.cuenta_por_pagar), suggestion?.cuenta_por_pagar?.codigo)}</dd>
                            </div>
                            <div className="purchases-card__field">
                                <dt>Retef.</dt>
                                <dd>
                                    {renderCell(
                                        it.params?.retefuente ? `${it.params.retefuente}%` : "?",
                                        suggestion?.cuenta_retefuente?.codigo
                                            ? `${suggestion.cuenta_retefuente.codigo} (${suggestion.retefuente_porcentaje ?? 0}%)`
                                            : undefined,
                                    )}
                                </dd>
                            </div>
                            <div className="purchases-card__field">
                                <dt>IA</dt>
                                <dd>{renderAiBadge(it, applied)}</dd>
                            </div>
                        </dl>
                        <footer className="purchases-card__actions">{renderActions(it, "cards")}</footer>
                    </article>
                );
            })}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const filterContent = (
        <>
            <FilterField label="Búsqueda" htmlFor="supplier-items-filter-search" icon="ri-search-line">
                <FieldControl
                    id="supplier-items-filter-search"
                    type="text"
                    value={filterSearch}
                    onChange={(e) => {
                        setFilterSearch(e.target.value);
                        if (page !== 1) {
                            setPage(1);
                            updateQueryParams({ page: 1 });
                        }
                    }}
                    placeholder="Producto o NIT"
                />
            </FilterField>
            <FilterField label="Estado" htmlFor="supplier-items-filter-status" icon="ri-filter-3-line">
                <FieldControl
                    as="select"
                    id="supplier-items-filter-status"
                    value={statusFilter}
                    onChange={(e) => {
                        const value = e.target.value;
                        setStatusFilter(value);
                        if (page !== 1) setPage(1);
                        updateQueryParams({ page: 1, status: value });
                    }}
                >
                    <option value="">Todos</option>
                    <option value="NO_PARAMETRIZADO">Pendientes</option>
                    <option value="PARAMETRIZADO">Parametrizados</option>
                </FieldControl>
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="supplier-items-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="supplier-items-filters-heading" className="purchases-filters-panel__title">
                    Filtrar productos
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
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="supplier-items-filters-panel"
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
                            id="supplier-items-filters-panel"
                            className="purchases-filters-panel purchases-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="supplier-items-filters-heading"
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
                        title="Parametrización de productos"
                        subtitle={`Cuentas contables y retención por producto de cada proveedor. ${
                            aiEnabled ? "La IA sugiere automáticamente." : "IA no configurada (parametrización manual)."
                        }`}
                        actions={
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setLearningOpen(true)}
                                title="Lo que la IA ha aprendido de tus parametrizaciones"
                            >
                                <i className="ri-brain-line" aria-hidden /> Autoaprendizaje
                            </button>
                        }
                    />
                </div>

                <FiltersMobileDrawer
                    open={filtersOpen && isMobile}
                    onClose={() => setFiltersOpen(false)}
                    title="Filtrar productos"
                    ariaLabelledBy="supplier-items-filters-heading-mobile"
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
                    emptyLabel={totalItems === 0 ? "Sin registros" : undefined}
                />

                {pendientes > 0 && (
                    <div className="purchases-summary" style={{ background: "rgba(255,159,67,.12)" }}>
                        <i className="ri-error-warning-line" style={{ color: "#e08a2b" }} aria-hidden />
                        <span>
                            <strong>{pendientes}</strong> producto(s) sin parametrizar.
                        </span>
                    </div>
                )}

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>
                        Cargando productos...
                    </div>
                ) : items.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-price-tag-3-line" aria-hidden />
                        <p>No hay productos de proveedor. Se crean automáticamente al importar compras.</p>
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
                            isFetching={isPageFetching}
                            onPageChange={handlePageChange}
                            emptyLabel={totalItems === 0 ? "Sin registros" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            {editing && (
                <AppModal
                    title={`${fromAi ? "Revisar sugerencia IA" : "Parametrizar"} - ${editing.codigo}`}
                    onClose={() => setEditing(null)}
                    closeDisabled={saving}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setEditing(null)} disabled={saving}>
                                Cancelar
                            </button>
                            <button type="button" className="export-submit" onClick={saveManual} disabled={saving}>
                                {saving ? "Guardando..." : fromAi ? "Aplicar" : "Guardar"}
                            </button>
                        </>
                    }
                >
                    <p className="pm-hint">{editing.descripcion}</p>
                    {fromAi && editing.ai_suggestion && (
                        <div className="led-balance ok" style={{ marginBottom: 12 }}>
                            <i className="ri-sparkling-line" aria-hidden /> Sugerencia de la IA (confianza{" "}
                            {editing.ai_suggestion.confianza ?? "?"}). Puedes editar lo que no esté bien antes de aplicar;{" "}
                            <strong>la IA aprenderá de tu corrección</strong>.
                            {editing.ai_suggestion.razonamiento ? (
                                <div style={{ fontSize: ".82rem", marginTop: 4, opacity: 0.85 }}>{editing.ai_suggestion.razonamiento}</div>
                            ) : null}
                        </div>
                    )}
                    <div className="led-form-grid">
                        <FilterField label="Cuenta gasto/costo *" htmlFor="si-gasto" icon="ri-money-dollar-circle-line">
                            <FieldControl id="si-gasto" value={form.gasto} onChange={(e) => setForm((f) => ({ ...f, gasto: e.target.value }))} placeholder="Ej. 51359501" />
                        </FilterField>
                        <FilterField label="Cuenta por pagar *" htmlFor="si-cxp" icon="ri-bank-card-line">
                            <FieldControl id="si-cxp" value={form.cxp} onChange={(e) => setForm((f) => ({ ...f, cxp: e.target.value }))} placeholder="Ej. 22050501" />
                        </FilterField>
                        <FilterField label="Cuenta IVA" htmlFor="si-iva" icon="ri-percent-line">
                            <FieldControl id="si-iva" value={form.iva} onChange={(e) => setForm((f) => ({ ...f, iva: e.target.value }))} placeholder="Ej. 24081001" />
                        </FilterField>
                        <FilterField label="Cuenta retefuente" htmlFor="si-retefuente-cta" icon="ri-shield-check-line">
                            <FieldControl
                                id="si-retefuente-cta"
                                value={form.retefuente_cta}
                                onChange={(e) => setForm((f) => ({ ...f, retefuente_cta: e.target.value }))}
                                placeholder="Ej. 23654001"
                            />
                        </FilterField>
                        <FilterField label="Retefuente (%)" htmlFor="si-retefuente" icon="ri-percent-line">
                            <FieldControl id="si-retefuente" type="number" step="0.01" value={form.retefuente} onChange={(e) => setForm((f) => ({ ...f, retefuente: e.target.value }))} />
                        </FilterField>
                        <FilterField label="Categoría de retención" htmlFor="si-categoria" icon="ri-folder-line">
                            <FieldControl as="select" id="si-categoria" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
                                <option value="">- Sin categoría -</option>
                                <option value="compras">Compras</option>
                                <option value="servicios">Servicios</option>
                                <option value="honorarios">Honorarios</option>
                                <option value="arrendamientos">Arrendamientos</option>
                                <option value="otros">Otros</option>
                            </FieldControl>
                        </FilterField>
                    </div>
                    <p className="pm-hint">
                        El estado pasa a &quot;Parametrizado&quot; cuando tiene cuenta de gasto y de por pagar. La categoría agrupa la retefuente por factura.
                    </p>
                </AppModal>
            )}

            <LearningPanel isOpen={learningOpen} onClose={() => setLearningOpen(false)} />
        </ListPageShell>
    );
};

export default SupplierItemsPage;
