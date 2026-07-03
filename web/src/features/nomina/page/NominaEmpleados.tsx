import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "./NominaEmpleados.css";
import "../../purchases/page/Purchases.css";
import { getAllEmpleados, getAllEmpleadosFull, deleteEmpleado, type Empleado } from "../../../services/empleados.service";
import { getNominaLotes, getNominaPlantilla, type Nomina, type LoteResumen, type PlantillaLote } from "../../../services/nomina.service";
import { TIPO_CONTRATO_OPTIONS, TIPO_TRABAJADOR_OPTIONS, labelFromCatalog } from "../nomina.constants";
import EmpleadoModal from "../../../components/modals/EmpleadoModal/EmpleadoModal";
import EmpleadoImportModal from "../../../components/modals/EmpleadoImportModal/EmpleadoImportModal";
import NominaModal from "../../../components/modals/NominaModal/NominaModal";
import NominaDetailModal from "../../../components/modals/NominaDetailModal/NominaDetailModal";
import NominaCertificados from "../components/NominaCertificados";
import NominaPila from "../components/NominaPila";
import NominaLotes from "../components/NominaLotes";
import "../../accounting/page/Configuration.css";
import "../../inventory/page/Inventory.css";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import CopyButton from "../../../components/shared/CopyButton/CopyButton";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    PaginationToolbar,
    paginationRange,
    FilterField,
    FieldControl,
    FiltersMobileDrawer,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";

type Tab = "empleados" | "nomina" | "certificados" | "pila";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const formatCOP = (value: number | string): string => {
    const n = typeof value === "string" ? Number(value) : value;
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
};

const VALID_TABS: Tab[] = ["empleados", "nomina", "certificados", "pila"];

const empleadoNombre = (emp: Empleado): string =>
    [emp.primer_nombre, emp.otros_nombres, emp.primer_apellido, emp.segundo_apellido].filter(Boolean).join(" ");

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "documento", label: "Documento", type: "text", icon: "ri-id-card-line" },
    { id: "tipo_trabajador", label: "Tipo trabajador", type: "select", icon: "ri-user-settings-line", options: TIPO_TRABAJADOR_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })) },
    { id: "contrato", label: "Contrato", type: "select", icon: "ri-article-line", options: TIPO_CONTRATO_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })) },
    { id: "sueldo", label: "Sueldo", type: "number", icon: "ri-money-dollar-circle-line" },
];

const matchEmpleadoSearch = (emp: Empleado, q: string): boolean => {
    const lower = q.toLowerCase();
    return empleadoNombre(emp).toLowerCase().includes(lower) || emp.numero_documento.includes(q);
};

const NominaEmpleadosPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = (searchParams.get("sec") as Tab) || "empleados";
    const [tab, setTabState] = useState<Tab>(VALID_TABS.includes(initialTab) ? initialTab : "empleados");

    useEffect(() => {
        const sec = searchParams.get("sec") as Tab;
        if (sec && VALID_TABS.includes(sec) && sec !== tab) setTabState(sec);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const qFromUrl = searchParams.get("q") ?? "";

    // ── Empleados ──
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [empleadosAll, setEmpleadosAll] = useState<Empleado[]>([]);
    const [empLoading, setEmpLoading] = useState(true);
    const [isEmpFetching, setIsEmpFetching] = useState(false);
    const [empPage, setEmpPage] = useState(pageFromUrl);
    const [empPageSize, setEmpPageSize] = useState(limitFromUrl);
    const [empTotal, setEmpTotal] = useState(0);
    const [empRefresh, setEmpRefresh] = useState(0);
    const [filterSearch, setFilterSearch] = useState(qFromUrl);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => qFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const isEmpSearching = debouncedSearch.trim() !== "";
    const getRowFilterValue = useCallback((row: Empleado, filterId: string): string => {
        switch (filterId) {
            case "documento": return row.numero_documento ?? "";
            case "tipo_trabajador": return row.tipo_trabajador ?? "";
            case "contrato": return row.tipo_contrato ?? "";
            case "sueldo": return String(row.sueldo ?? 0);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || hasActiveClientFilters;

    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
    const [empToDelete, setEmpToDelete] = useState<Empleado | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── Nómina (agrupada por lote/periodo) ──
    const [lotes, setLotes] = useState<LoteResumen[]>([]);
    const [nomLoading, setNomLoading] = useState(true);
    const [nomRefresh, setNomRefresh] = useState(0);
    const [isNominaModalOpen, setIsNominaModalOpen] = useState(false);
    const [selectedNomina, setSelectedNomina] = useState<Nomina | null>(null);
    const [plantilla, setPlantilla] = useState<PlantillaLote | null>(null);
    const [loadingPlantilla, setLoadingPlantilla] = useState(false);

    const filteredEmpleados = useMemo(() => {
        if (!isEmpSearching) return empleados;
        const q = debouncedSearch.trim();
        return empleadosAll.filter((emp) => matchEmpleadoSearch(emp, q));
    }, [isEmpSearching, empleados, empleadosAll, debouncedSearch]);

    const empTotalEffective = isEmpSearching ? filteredEmpleados.length : empTotal;
    const empTotalPages = Math.max(1, Math.ceil(empTotalEffective / empPageSize));
    const safeEmpPage = Math.min(empPage, empTotalPages);

    const baseDisplayedEmpleados = useMemo(() => {
        if (!isEmpSearching) return empleados;
        const start = (safeEmpPage - 1) * empPageSize;
        return filteredEmpleados.slice(start, start + empPageSize);
    }, [isEmpSearching, empleados, filteredEmpleados, safeEmpPage, empPageSize]);
    const displayedEmpleados = filterRows(baseDisplayedEmpleados);

    const { start: empRangeStart, end: empRangeEnd } = paginationRange(safeEmpPage, empPageSize, empTotalEffective);

    const updateEmpFiltersInQuery = (updates: { q?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            if (updates.q !== undefined) {
                const value = updates.q.trim();
                if (!value) params.delete("q");
                else params.set("q", value);
            }
            return params;
        });
        setEmpPage(1);
    };

    const handleEmpPageChange = (nextPage: number) => {
        const safePage = Math.max(1, Math.min(empTotalPages, nextPage));
        setEmpPage(safePage);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", String(safePage));
            return params;
        });
    };

    const handleEmpPageSizeChange = (nextSize: number) => {
        const safeSize = normalizePageSize(nextSize);
        setEmpPageSize(safeSize);
        setEmpPage(1);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            params.set("limit", String(safeSize));
            return params;
        });
    };

    const clearFilters = () => {
        setFilterSearch("");
        updateEmpFiltersInQuery({ q: "" });
        clearColFilters();
    };

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        if (empPage !== 1) {
            setEmpPage(1);
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                params.set("page", "1");
                return params;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, empPageSize]);

    useEffect(() => {
        const timeout = window.setTimeout(() => updateEmpFiltersInQuery({ q: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        if (empPage > empTotalPages) handleEmpPageChange(empTotalPages);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empPage, empTotalPages]);

    useEffect(() => {
        if (!isEmpSearching) return;
        let ignore = false;
        setIsEmpFetching(true);
        if (empleadosAll.length === 0) setEmpLoading(true);
        (async () => {
            try {
                const all = await getAllEmpleadosFull();
                if (ignore) return;
                setEmpleadosAll(all);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar empleados");
            } finally {
                if (!ignore) {
                    setEmpLoading(false);
                    setIsEmpFetching(false);
                }
            }
        })();
        return () => {
            ignore = true;
        };
    }, [isEmpSearching, empRefresh]);

    useEffect(() => {
        if (isEmpSearching) return;
        let ignore = false;
        const hasData = empleados.length > 0;
        if (hasData) setIsEmpFetching(true);
        else setEmpLoading(true);
        (async () => {
            try {
                const res = await getAllEmpleados(safeEmpPage, empPageSize);
                if (ignore) return;
                setEmpleados(res.items);
                setEmpTotal(res.total);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar empleados");
            } finally {
                if (!ignore) {
                    setEmpLoading(false);
                    setIsEmpFetching(false);
                }
            }
        })();
        return () => {
            ignore = true;
        };
    }, [isEmpSearching, safeEmpPage, empPageSize, empRefresh]);

    useEffect(() => {
        let ignore = false;
        setNomLoading(true);
        (async () => {
            try {
                const res = await getNominaLotes();
                if (ignore) return;
                setLotes(res.lotes);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar nóminas");
            } finally {
                if (!ignore) setNomLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [nomRefresh]);

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;
        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(480, window.innerWidth - 32);
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch]);

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
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKey);
        };
    }, [filtersOpen, isMobile]);

    const handleGenerarMesSiguiente = async (fromPeriodoKey?: string) => {
        setLoadingPlantilla(true);
        try {
            const tpl = await getNominaPlantilla(fromPeriodoKey);
            if (!tpl.items.length) {
                errorToast("No hay un lote anterior para usar como plantilla. Emite la primera nómina del periodo.");
                return;
            }
            setPlantilla(tpl);
            setIsNominaModalOpen(true);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al generar la plantilla");
        } finally {
            setLoadingPlantilla(false);
        }
    };

    const handleConfirmDeleteEmpleado = async () => {
        if (!empToDelete) return;
        setIsDeleting(true);
        try {
            await deleteEmpleado(empToDelete._id);
            successToast("Empleado eliminado correctamente");
            if (displayedEmpleados.length === 1 && safeEmpPage > 1) handleEmpPageChange(safeEmpPage - 1);
            else setEmpRefresh((k) => k + 1);
            setEmpToDelete(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al eliminar el empleado");
        } finally {
            setIsDeleting(false);
        }
    };

    const renderEmpActions = (emp: Empleado, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions nomina-actions--${layout}`}>
            <button className="btn-action" title="Editar" onClick={() => { setSelectedEmpleado(emp); setIsEmpModalOpen(true); }}>
                <i className="ri-edit-line" aria-hidden />
            </button>
            <button className="btn-action" title="Eliminar" onClick={() => setEmpToDelete(emp)}>
                <i className="ri-delete-bin-line" aria-hidden />
            </button>
        </div>
    );

    const renderEmpTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Documento</th>
                        <th>Tipo trabajador</th>
                        <th>Contrato</th>
                        <th>Sueldo</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedEmpleados.map((emp) => (
                        <tr key={emp._id}>
                            <td className="cell-strong" data-label="Nombre">{empleadoNombre(emp)}</td>
                            <td data-label="Documento">
                                {emp.numero_documento}
                                <CopyButton value={emp.numero_documento} label="documento" />
                            </td>
                            <td data-label="Tipo trabajador">{labelFromCatalog(TIPO_TRABAJADOR_OPTIONS, emp.tipo_trabajador)}</td>
                            <td data-label="Contrato">{labelFromCatalog(TIPO_CONTRATO_OPTIONS, emp.tipo_contrato)}</td>
                            <td data-label="Sueldo">{formatCOP(emp.sueldo)}</td>
                            <td data-label="Acciones">{renderEmpActions(emp)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderEmpList = () => (
        <div className="purchases-list-view">
            {displayedEmpleados.map((emp) => (
                <article key={emp._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{empleadoNombre(emp)}</strong>
                            <span className="purchases-list-item__amount-badge">{formatCOP(emp.sueldo)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{emp.numero_documento}</strong>
                            <span>{labelFromCatalog(TIPO_CONTRATO_OPTIONS, emp.tipo_contrato)}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Tipo trabajador</dt>
                                <dd>{labelFromCatalog(TIPO_TRABAJADOR_OPTIONS, emp.tipo_trabajador)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderEmpActions(emp, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderEmpCards = () => (
        <div className="purchases-cards-view">
            {displayedEmpleados.map((emp) => (
                <article key={emp._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{empleadoNombre(emp)}</strong>
                        <span className="purchases-card__amount-badge">{formatCOP(emp.sueldo)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{emp.numero_documento}</strong>
                        <span>· {labelFromCatalog(TIPO_CONTRATO_OPTIONS, emp.tipo_contrato)}</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Tipo trabajador</dt>
                            <dd>{labelFromCatalog(TIPO_TRABAJADOR_OPTIONS, emp.tipo_trabajador)}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">{renderEmpActions(emp, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderEmpView = () => {
        if (effectiveViewMode === "list") return renderEmpList();
        if (effectiveViewMode === "cards") return renderEmpCards();
        return renderEmpTable();
    };

    const filterContent = (
        <>
            <FilterField label="Búsqueda" htmlFor="empleados-filter-search" icon="ri-search-line">
                <FieldControl
                    id="empleados-filter-search"
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Nombre o documento"
                />
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="empleados-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="nomina-filters-panel__head">
                <h2 id="empleados-filters-heading" className="nomina-filters-panel__title">
                    Filtrar empleados
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="nomina-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="nomina-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="nomina-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="nomina-filters-clear nomina-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="nomina-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`nomina-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((value) => !value)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="empleados-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="nomina-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line nomina-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="empleados-filters-panel"
                            className="nomina-filters-panel nomina-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="empleados-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    const empShowEmpty = !empLoading && !isEmpFetching && (isEmpSearching ? empleadosAll.length === 0 : empTotal === 0);
    const empShowNoResults = !empLoading && !isEmpFetching && isEmpSearching && empleadosAll.length > 0 && filteredEmpleados.length === 0;

    return (
        <main className="nomina-page">
            <div className="nomina-container">
                <div className="nomina-sticky-head">
                    <div className="nomina-header">
                        <div className="header-content">
                            <h1>Nómina y empleados</h1>
                            <p>Gestiona tus empleados y emite la nómina electrónica a la DIAN</p>
                        </div>
                        <div className="nomina-actions">
                            {tab === "empleados" && (
                                <>
                                    <button className="btn-secondary" onClick={() => setIsImportModalOpen(true)} title="Cargar o actualizar empleados desde un archivo CSV/Excel">
                                        <i className="ri-file-excel-2-line" /> Importar / Plantilla
                                    </button>
                                    <button className="btn-primary" onClick={() => { setSelectedEmpleado(null); setIsEmpModalOpen(true); }}>
                                        <i className="ri-user-add-line" /> Nuevo empleado
                                    </button>
                                </>
                            )}
                            {tab === "nomina" && (
                                <>
                                    <button className="btn-secondary" onClick={() => handleGenerarMesSiguiente()} disabled={loadingPlantilla || lotes.length === 0} title="Clona el último periodo emitido para el mes siguiente">
                                        {loadingPlantilla ? (<><i className="ri-loader-4-line rotating" /> Generando...</>) : (<><i className="ri-file-copy-line" /> Generar mes siguiente</>)}
                                    </button>
                                    <button className="btn-primary" onClick={() => { setPlantilla(null); setIsNominaModalOpen(true); }}>
                                        <i className="ri-add-line" /> Emitir nómina
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {tab === "empleados" && (
                    <>
                        <FiltersMobileDrawer
                            open={filtersOpen && isMobile}
                            onClose={() => setFiltersOpen(false)}
                            title="Filtrar empleados"
                            ariaLabelledBy="empleados-filters-heading-mobile"
                            hasActiveFilters={hasActiveFilters}
                            onClear={clearFilters}
                        >
                            {filterContent}
                        </FiltersMobileDrawer>

                        {!empShowEmpty && (
                            <PaginationToolbar
                                position="top"
                                page={safeEmpPage}
                                totalPages={empTotalPages}
                                totalItems={empTotalEffective}
                                pageSize={empPageSize}
                                pageSizeOptions={PAGE_SIZE_OPTIONS}
                                rangeStart={empRangeStart}
                                rangeEnd={empRangeEnd}
                                isFetching={isEmpFetching || empLoading}
                                onPageChange={handleEmpPageChange}
                                onPageSizeChange={handleEmpPageSizeChange}
                                viewMode={viewMode}
                                onViewModeChange={setViewMode}
                                showViewToggle
                                beforeViewToggle={filtersToolbar}
                                emptyLabel={empTotalEffective === 0 ? "Sin empleados" : undefined}
                            />
                        )}

                        {empLoading ? (
                            <div className="page-loading ds-empty"><p>Cargando empleados...</p></div>
                        ) : empShowEmpty ? (
                            <div className="page-loading ds-empty"><p>No hay empleados registrados. Crea el primero con &quot;Nuevo empleado&quot;.</p></div>
                        ) : empShowNoResults ? (
                            <div className="page-loading ds-empty"><p>No hay empleados que coincidan con la búsqueda</p></div>
                        ) : (
                            <>
                                {renderEmpView()}
                                <PaginationToolbar
                                    position="bottom"
                                    page={safeEmpPage}
                                    totalPages={empTotalPages}
                                    totalItems={empTotalEffective}
                                    pageSize={empPageSize}
                                    rangeStart={empRangeStart}
                                    rangeEnd={empRangeEnd}
                                    isFetching={isEmpFetching}
                                    onPageChange={handleEmpPageChange}
                                    emptyLabel={empTotalEffective === 0 ? "Sin empleados" : undefined}
                                />
                            </>
                        )}
                    </>
                )}

                {tab === "nomina" && (
                    <NominaLotes
                        lotes={lotes}
                        loading={nomLoading}
                        loadingPlantilla={loadingPlantilla}
                        onGenerarMesSiguiente={handleGenerarMesSiguiente}
                        onSelectNomina={setSelectedNomina}
                    />
                )}

                {tab === "certificados" && <NominaCertificados />}
                {tab === "pila" && <NominaPila />}
            </div>

            <EmpleadoModal
                isOpen={isEmpModalOpen}
                onClose={() => { setIsEmpModalOpen(false); setSelectedEmpleado(null); }}
                onSuccess={() => setEmpRefresh((k) => k + 1)}
                empleado={selectedEmpleado}
            />
            <EmpleadoImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    setEmpPage(1);
                    setSearchParams((prev) => {
                        const params = new URLSearchParams(prev);
                        params.set("page", "1");
                        return params;
                    });
                    setEmpRefresh((k) => k + 1);
                }}
            />
            <NominaModal
                isOpen={isNominaModalOpen}
                onClose={() => { setIsNominaModalOpen(false); setPlantilla(null); }}
                onSuccess={() => {
                    setNomRefresh((k) => k + 1);
                }}
                plantilla={plantilla}
            />
            <NominaDetailModal
                isOpen={!!selectedNomina}
                onClose={() => setSelectedNomina(null)}
                nomina={selectedNomina}
                onUpdated={(updated) => {
                    setSelectedNomina(updated);
                    setNomRefresh((k) => k + 1);
                }}
            />
            <ConfirmModal
                isOpen={!!empToDelete}
                onClose={() => setEmpToDelete(null)}
                onConfirm={handleConfirmDeleteEmpleado}
                title="¿Eliminar empleado?"
                message={`¿Seguro que deseas eliminar a "${empToDelete?.primer_nombre ?? ""} ${empToDelete?.primer_apellido ?? ""}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                type="danger"
                loading={isDeleting}
            />
        </main>
    );
};

export default NominaEmpleadosPage;
