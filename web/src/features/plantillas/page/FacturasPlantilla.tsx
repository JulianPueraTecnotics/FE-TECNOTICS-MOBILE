import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./FacturasPlantilla.css";
import type { InvoiceTemplate } from "../../../types";
import { RECURRENCE_LABELS, type RecurrenceType } from "../../../types";
import { PATHS } from "../../../router/paths.contants";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getTemplates, setInvoiceTemplate, markTemplateInvoiced } from "../../../services/plantillas.service";
import PlantillaActionModals, { type PlantillaActionKind, type PlantillaActionState } from "../components/PlantillaActionModals";
import { formatCOP } from "../../../utils/format";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
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
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const formatDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

const toIsoDate = (iso?: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const PERIODO_LABEL: Partial<Record<RecurrenceType, string>> = {
    weekly: "esta semana",
    monthly: "este mes",
    bimonthly: "este bimestre",
    quarterly: "este trimestre",
    yearly: "este año",
};

const diasHasta = (iso?: string): number | null => {
    if (!iso) return null;
    const d = new Date(iso).getTime();
    if (Number.isNaN(d)) return null;
    return Math.ceil((d - Date.now()) / (24 * 60 * 60 * 1000));
};

type EstadoPlantilla = { texto: string; tono: "pendiente" | "proximo" | "aldia" | "neutro"; icono: string };

const estadoPlantilla = (t: InvoiceTemplate): EstadoPlantilla => {
    if (t.recurrence === "none") return { texto: "Sin recurrencia", tono: "neutro", icono: "ri-subtract-line" };
    const periodo = PERIODO_LABEL[t.recurrence] ?? "en este período";
    if (t.pending) {
        const yearly = t.recurrence === "yearly";
        return {
            texto: yearly ? "Se cumplió el año — pendiente por facturar" : `Pendiente por facturar ${periodo}`,
            tono: "pendiente",
            icono: "ri-error-warning-line",
        };
    }
    const dias = diasHasta(t.next_due);
    if (dias != null && dias <= 5)
        return { texto: `Próxima en ${dias} día${dias === 1 ? "" : "s"} · ${formatDate(t.next_due)}`, tono: "proximo", icono: "ri-time-line" };
    return { texto: `Al día · próxima: ${formatDate(t.next_due)}`, tono: "aldia", icono: "ri-checkbox-circle-line" };
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "documento", label: "Documento", type: "text", icon: "ri-file-list-3-line" },
    { id: "cliente", label: "Cliente", type: "text", icon: "ri-user-search-line", serverSide: true },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "recurrencia", label: "Recurrencia", type: "select", icon: "ri-repeat-line", options: [{ value: "none", label: "Sin recurrencia" }, { value: "weekly", label: "Semanal" }, { value: "monthly", label: "Mensual" }, { value: "bimonthly", label: "Bimestral" }, { value: "quarterly", label: "Trimestral" }, { value: "yearly", label: "Anual" }], serverSide: true },
    { id: "proxima", label: "Próx. facturación", type: "date", icon: "ri-calendar-line" },
];

const FacturasPlantillaPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const recurrenceFromUrl = searchParams.get("recurrence") ?? "all";
    const clienteFromUrl = searchParams.get("cliente") ?? "";

    const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [recFilter, setRecFilter] = useState(recurrenceFromUrl);
    const [filterSearch, setFilterSearch] = useState(clienteFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => recurrenceFromUrl !== "all" || clienteFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const getRowFilterValue = useCallback((row: InvoiceTemplate, filterId: string): string => {
        switch (filterId) {
            case "documento": return row.number ?? "";
            case "cliente": return row.client_name ?? "";
            case "total": return String(row.total ?? 0);
            case "recurrencia": return row.recurrence ?? "";
            case "proxima": return toIsoDate(row.next_due);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = recFilter !== "all" || filterSearch.trim() !== "" || hasActiveClientFilters;

    const [pendingAction, setPendingAction] = useState<PlantillaActionState>(null);
    const [actionLoading, setActionLoading] = useState(false);

    useRealtime(RealtimeEvents.TEMPLATE_CHANGED, () => setRefreshKey((k) => k + 1));

    const updateFiltersInQuery = (updates: { recurrence?: string; cliente?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            if (updates.recurrence !== undefined) {
                const v = updates.recurrence.trim();
                if (!v || v === "all") params.delete("recurrence");
                else params.set("recurrence", v);
            }
            if (updates.cliente !== undefined) {
                const v = updates.cliente.trim();
                if (!v) params.delete("cliente");
                else params.set("cliente", v);
            }
            return params;
        });
        setPage(1);
    };

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        if (page !== 1) {
            setPage(1);
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                params.set("page", "1");
                return params;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, recFilter, pageSize]);

    useEffect(() => {
        const t = window.setTimeout(() => updateFiltersInQuery({ cliente: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        let ignore = false;
        setLoading(true);
        (async () => {
            try {
                const res = await getTemplates({ recurrence: recFilter, cliente: debouncedSearch.trim() || undefined });
                if (ignore || !res) return;
                setTemplates(res.templates ?? []);
                setPendingCount(res.pending_count ?? 0);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "No se pudieron cargar las plantillas");
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [recFilter, debouncedSearch, refreshKey]);

    const filteredTemplates = filterRows(templates);
    const totalItems = filteredTemplates.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);

    const paginatedTemplates = useMemo(() => {
        const p = Math.min(page, Math.max(1, Math.ceil(totalItems / pageSize) || 1));
        const startIdx = (p - 1) * pageSize;
        return filteredTemplates.slice(startIdx, startIdx + pageSize);
    }, [filteredTemplates, page, pageSize, totalItems]);

    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const handlePageChange = (nextPage: number) => {
        const p = Math.max(1, Math.min(totalPages, nextPage));
        setPage(p);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", String(p));
            return params;
        });
    };

    const handlePageSizeChange = (nextSize: number) => {
        const safeSize = normalizePageSize(nextSize);
        setPageSize(safeSize);
        setPage(1);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            params.set("limit", String(safeSize));
            return params;
        });
    };

    const clearFilters = () => {
        setRecFilter("all");
        setFilterSearch("");
        updateFiltersInQuery({ recurrence: "all", cliente: "" });
        clearColFilters();
    };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;
        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(720, window.innerWidth - 32);
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, recFilter, filterSearch]);

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

    const openPlantillaAction = (kind: PlantillaActionKind, t: InvoiceTemplate) => {
        setPendingAction({ kind, template: t });
    };

    const closePlantillaAction = () => {
        if (actionLoading) return;
        setPendingAction(null);
    };

    const handleConfirmRecreate = async () => {
        if (!pendingAction || pendingAction.kind !== "recreate") return;
        const t = pendingAction.template;
        setActionLoading(true);
        try {
            try {
                await markTemplateInvoiced(t._id);
            } catch {
                /* si falla el marcado, igual dejamos recrear */
            }
            setPendingAction(null);
            navigate(PATHS.DASHBOARD_BILLING, { state: { recreate_factura_id: t._id } });
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmRemove = async () => {
        if (!pendingAction || pendingAction.kind !== "remove") return;
        const t = pendingAction.template;
        setActionLoading(true);
        try {
            await setInvoiceTemplate(t._id, { is_template: false });
            successToast("Quitada de plantillas");
            setRefreshKey((k) => k + 1);
            setPendingAction(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo quitar");
        } finally {
            setActionLoading(false);
        }
    };

    const estadoTexto = (t: InvoiceTemplate) => estadoPlantilla(t).texto;

    const renderRecurrence = (t: InvoiceTemplate) => (
        <span className={`plantilla-rec plantilla-rec--${t.recurrence}`}>{RECURRENCE_LABELS[t.recurrence as RecurrenceType] ?? t.recurrence}</span>
    );

    const renderEstado = (t: InvoiceTemplate) => {
        const est = estadoPlantilla(t);
        return (
            <span className={`plantilla-estado plantilla-estado--${est.tono}`}>
                <i className={est.icono} aria-hidden /> {est.texto}
            </span>
        );
    };

    const rowLocked = (id: string) => pendingAction?.template._id === id && actionLoading;

    const renderActions = (t: InvoiceTemplate, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions plantillas-actions--${layout}`}>
            <button type="button" className="btn-recreate" onClick={() => openPlantillaAction("recreate", t)} title="Crear factura desde esta plantilla" disabled={rowLocked(t._id)}>
                <i className="ri-file-copy-line" aria-hidden />
                Recrear
            </button>
            <button type="button" className="btn-action" title="Quitar de plantillas" onClick={() => openPlantillaAction("remove", t)} disabled={rowLocked(t._id)}>
                <i className="ri-bookmark-2-line" aria-hidden />
            </button>
        </div>
    );

    const renderTable = () => (
        <div className="plantillas-table-container ds-table-container">
            <table className="plantillas-table ds-table">
                <thead>
                    <tr>
                        <th>Documento</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Recurrencia</th>
                        <th>Próx. facturación</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedTemplates.map((t) => (
                        <tr key={t._id} className={t.pending ? "plantillas-row--pending" : undefined}>
                            <td data-label="Documento">{t.number}</td>
                            <td data-label="Cliente">{t.client_name || "—"}</td>
                            <td data-label="Total">{formatCOP(t.total)}</td>
                            <td data-label="Recurrencia">{renderRecurrence(t)}</td>
                            <td data-label="Próx. facturación">{renderEstado(t)}</td>
                            <td data-label="Acciones">{renderActions(t)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="plantillas-list-view">
            {paginatedTemplates.map((t) => (
                <article key={t._id} className={`plantillas-list-item ${t.pending ? "plantillas-list-item--pending" : ""}`.trim()}>
                    <div className="plantillas-list-item__body">
                        <div className="plantillas-list-item__head">
                            <strong className="plantillas-list-item__number">{t.number}</strong>
                            {renderRecurrence(t)}
                        </div>
                        <div className="plantillas-list-item__main">
                            <p className="plantillas-list-item__client">{t.client_name || "—"}</p>
                            <p className="plantillas-list-item__total">{formatCOP(t.total)}</p>
                        </div>
                        <div className="plantillas-list-item__estado">{renderEstado(t)}</div>
                    </div>
                    <footer className="plantillas-list-item__actions">{renderActions(t, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="plantillas-cards-view">
            {paginatedTemplates.map((t) => (
                <article key={t._id} className={`plantillas-card ${t.pending ? "plantillas-card--pending" : ""}`.trim()}>
                    <div className="plantillas-card__body">
                        <div className="plantillas-card__header">
                            <strong className="plantillas-card__number">{t.number}</strong>
                            {renderRecurrence(t)}
                        </div>
                        <div className="plantillas-card__main">
                            <p className="plantillas-card__client">{t.client_name || "—"}</p>
                            <span className="plantillas-card__total">{formatCOP(t.total)}</span>
                        </div>
                        <div className="plantillas-card__estado">{renderEstado(t)}</div>
                    </div>
                    <footer className="plantillas-card__actions">{renderActions(t, "cards")}</footer>
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
            <FilterField label="Recurrencia" htmlFor="plantillas-filter-recurrence" icon="ri-repeat-line">
                                        <FieldControl
                                            as="select"
                                            id="plantillas-filter-recurrence"
                                            value={recFilter}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setRecFilter(value);
                                                updateFiltersInQuery({ recurrence: value });
                                            }}
                                        >
                                            <option value="all">Todas</option>
                                            <option value="recurrent">Solo recurrentes</option>
                                            {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </FieldControl>
                                    </FilterField>
                                    <FilterField label="Búsqueda" htmlFor="plantillas-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="plantillas-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Plantilla o cliente"
                                        />
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="plantillas-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="plantillas-filters-panel__head">
                <h2 id="plantillas-filters-heading" className="plantillas-filters-panel__title">
                    Filtrar plantillas
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="plantillas-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="plantillas-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="plantillas-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="plantillas-filters-clear plantillas-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="plantillas-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`plantillas-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="plantillas-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="plantillas-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line plantillas-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="plantillas-filters-panel"
                            className="plantillas-filters-panel plantillas-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="plantillas-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="plantillas-page">
            <ListPageContainer className="plantillas-container">
                <div className="plantillas-sticky-head">
                    <ListPageHeader
                        className="plantillas-header"
                        title="Facturas de plantilla"
                        subtitle="Reutiliza facturas frecuentes y gestiona las recurrentes"
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar plantillas"
    ariaLabelledBy="plantillas-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                {pendingCount > 0 &&
                    (() => {
                        const pendientes = templates.filter((t) => t.pending && t.recurrence !== "none");
                        const porRec = pendientes.reduce<Record<string, number>>((acc, t) => {
                            acc[t.recurrence] = (acc[t.recurrence] ?? 0) + 1;
                            return acc;
                        }, {});
                        const detalle = Object.entries(porRec)
                            .map(([rec, n]) => `${n} ${(RECURRENCE_LABELS[rec as RecurrenceType] ?? rec).toLowerCase()}`)
                            .join(", ");
                        return (
                            <div className="plantillas-pending-banner">
                                <i className="ri-alarm-warning-line" aria-hidden />
                                <span>
                                    Tienes <strong>{pendingCount}</strong> factura(s) recurrente(s) pendiente(s) por facturar
                                    {detalle ? <> ({detalle})</> : null}.
                                </span>
                            </div>
                        );
                    })()}

                <PaginationToolbar
                    position="top"
                    page={safePage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    rangeStart={start}
                    rangeEnd={end}
                    isFetching={loading}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showViewToggle
                    beforeViewToggle={filtersToolbar}
                    emptyLabel={totalItems === 0 ? "Sin registros" : undefined}
                />

                {loading ? (
                    <div className="page-loading">
                        <p>Cargando plantillas...</p>
                    </div>
                ) : templates.length === 0 ? (
                    <div className="page-loading">
                        <p>No hay plantillas. Guarda una factura como plantilla desde &quot;Facturas&quot;.</p>
                    </div>
                ) : (
                    <>
                        {renderView()}
                        <PaginationToolbar
                            position="bottom"
                            page={safePage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            rangeStart={start}
                            rangeEnd={end}
                            onPageChange={handlePageChange}
                            emptyLabel={totalItems === 0 ? "Sin registros" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            <PlantillaActionModals
                action={pendingAction}
                loading={actionLoading}
                onClose={closePlantillaAction}
                onRecreate={handleConfirmRecreate}
                onRemove={handleConfirmRemove}
                estadoTexto={estadoTexto}
            />
        </ListPageShell>
    );
};

export default FacturasPlantillaPage;
