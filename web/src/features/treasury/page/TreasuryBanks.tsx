import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import "./ConciliacionBancaria.css";
import { getBanks, createBank, updateBank, deleteBank } from "../treasury.service";
import type { Bank } from "../treasury.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    AppDrawer,
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

const empty = { nombre_banco: "", numero_cuenta: "", tipo_cuenta: "corriente", identificador: "6", validacion_id: "V", descripcion_lote: "PROVEEDOR" };

type EstadoFilter = "" | "activo" | "inactivo";

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "banco", label: "Banco", type: "text", icon: "ri-bank-line", serverSide: true },
    { id: "cuenta", label: "Cuenta", type: "text", icon: "ri-bank-card-line" },
    { id: "tipo", label: "Tipo", type: "select", icon: "ri-wallet-3-line", options: [{ value: "ahorros", label: "Ahorros" }, { value: "corriente", label: "Corriente" }] },
    { id: "lote", label: "Descripción lote", type: "text", icon: "ri-file-text-line" },
    { id: "estado", label: "Estado", type: "select", icon: "ri-toggle-line", options: [{ value: "activo", label: "Activo" }, { value: "inactivo", label: "Inactivo" }], serverSide: true },
];

const TreasuryBanksPage: React.FC = () => {
    const [banks, setBanks] = useState<Bank[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filterSearch, setFilterSearch] = useState("");
    const [filterEstado, setFilterEstado] = useState<EstadoFilter>("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const getRowFilterValue = useCallback((row: Bank, filterId: string): string => {
        switch (filterId) {
            case "banco": return row.nombre_banco ?? "";
            case "cuenta": return row.numero_cuenta ?? "";
            case "tipo": return row.tipo_cuenta ?? "";
            case "lote": return row.descripcion_lote ?? "";
            case "estado": return row.active ? "activo" : "inactivo";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || filterEstado !== "" || hasActiveClientFilters;

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Bank | null>(null);
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    useBodyScrollLock(modalOpen);

    useRealtime(RealtimeEvents.BANK_CHANGED, (payload) => {
        setBanks((prev) => applyRealtimeChange(prev, payload));
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getBanks();
            setBanks(res.banks);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar bancos");
        } finally {
            setLoading(false);
        }
    }, [refreshKey]);

    useEffect(() => {
        load();
    }, [load]);

    const filteredBanks = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        return banks.filter((b) => {
            if (filterEstado === "activo" && !b.active) return false;
            if (filterEstado === "inactivo" && b.active) return false;
            if (q && !b.nombre_banco.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [banks, debouncedSearch, filterEstado]);

    const displayedBanks = filterRows(filteredBanks);
    const totalItems = displayedBanks.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedBanks = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return displayedBanks.slice(start, start + pageSize);
    }, [displayedBanks, safePage, pageSize]);

    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        setPage(1);
    }, [debouncedSearch, filterEstado, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, filterEstado]);

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
        setPage(Math.max(1, Math.min(totalPages, nextPage)));
    };

    const handlePageSizeChange = (nextSize: number) => {
        setPageSize(normalizePageSize(nextSize));
        setPage(1);
    };

    const clearFilters = () => {
        setFilterSearch("");
        setFilterEstado("");
        clearColFilters();
    };

    const openCreate = () => {
        setEditing(null);
        setForm(empty);
        setModalOpen(true);
    };

    const openEdit = (b: Bank) => {
        setEditing(b);
        setForm({
            nombre_banco: b.nombre_banco,
            numero_cuenta: b.numero_cuenta,
            tipo_cuenta: b.tipo_cuenta,
            identificador: b.identificador,
            validacion_id: b.validacion_id,
            descripcion_lote: b.descripcion_lote,
        });
        setModalOpen(true);
    };

    const save = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!form.nombre_banco.trim() || !form.numero_cuenta.trim()) {
            errorToast("Banco y número de cuenta son obligatorios");
            return;
        }
        setSaving(true);
        try {
            if (editing) await updateBank(editing._id, form as Partial<Bank>);
            else await createBank(form as Partial<Bank>);
            successToast(editing ? "Banco actualizado" : "Banco creado");
            setModalOpen(false);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deleteBank(toDelete.id);
            successToast("Banco eliminado");
            setToDelete(null);
            if (paginatedBanks.length === 1 && safePage > 1) setPage(safePage - 1);
            else setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const renderEstadoBadge = (b: Bank) => (
        <span className={`status-badge ${b.active ? "status-paid" : "status-pending"}`}>{b.active ? "Activo" : "Inactivo"}</span>
    );

    const renderActions = (b: Bank, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            <button type="button" className="btn-action" title="Editar" onClick={() => openEdit(b)}>
                <i className="ri-edit-line" aria-hidden />
                {layout === "table" ? "Editar" : null}
            </button>
            <button type="button" className="btn-action" title="Eliminar" onClick={() => setToDelete({ id: b._id, name: b.nombre_banco })}>
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
                        <th>Banco</th>
                        <th>Cuenta</th>
                        <th>Tipo</th>
                        <th>Descripción lote</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedBanks.map((b) => (
                        <tr key={b._id}>
                            <td data-label="Banco">{b.nombre_banco}</td>
                            <td data-label="Cuenta">{b.numero_cuenta}</td>
                            <td data-label="Tipo">{b.tipo_cuenta === "ahorros" ? "Ahorros" : "Corriente"}</td>
                            <td data-label="Descripción lote">{b.descripcion_lote}</td>
                            <td data-label="Estado">{renderEstadoBadge(b)}</td>
                            <td data-label="Acciones">{renderActions(b)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const tipoCuentaLabel = (b: Bank) => (b.tipo_cuenta === "ahorros" ? "Ahorros" : "Corriente");

    const renderList = () => (
        <div className="purchases-list-view">
            {paginatedBanks.map((b) => (
                <article key={b._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{b.nombre_banco}</strong>
                            <span className="purchases-list-item__amount-badge">{renderEstadoBadge(b)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{b.numero_cuenta}</strong>
                            <span>{tipoCuentaLabel(b)}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Descripción lote</dt>
                                <dd>{b.descripcion_lote || "—"}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Identificador ACH</dt>
                                <dd>{b.identificador || "—"}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Validación ACH</dt>
                                <dd>{b.validacion_id || "—"}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderActions(b, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginatedBanks.map((b) => (
                <article key={b._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{b.nombre_banco}</strong>
                        {renderEstadoBadge(b)}
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{b.numero_cuenta}</strong>
                        <span>· {tipoCuentaLabel(b)}</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Descripción lote</dt>
                            <dd>{b.descripcion_lote || "—"}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Identificador ACH</dt>
                            <dd>{b.identificador || "—"}</dd>
                        </div>
                        <div className="purchases-card__field purchases-card__field--full">
                            <dt>Validación ACH</dt>
                            <dd>{b.validacion_id || "—"}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">{renderActions(b, "cards")}</footer>
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
            <FilterField label="Búsqueda" htmlFor="banks-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="banks-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Nombre del banco"
                                        />
                                    </FilterField>
                                    <FilterField label="Estado" htmlFor="banks-filter-estado" icon="ri-toggle-line">
                                        <FieldControl
                                            id="banks-filter-estado"
                                            as="select"
                                            value={filterEstado}
                                            onChange={(e) => setFilterEstado(e.target.value as EstadoFilter)}
                                        >
                                            <option value="">Todos</option>
                                            <option value="activo">Activo</option>
                                            <option value="inactivo">Inactivo</option>
                                        </FieldControl>
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="banks-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="banks-filters-heading" className="purchases-filters-panel__title">
                    Filtrar bancos
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
                    aria-controls="banks-filters-panel"
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
                            id="banks-filters-panel"
                            className="purchases-filters-panel purchases-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="banks-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    const showEmpty = !loading && banks.length === 0;
    const showNoResults = !loading && banks.length > 0 && totalItems === 0;

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <div className="purchases-sticky-head">
                    <ListPageHeader
                        className="purchases-header"
                        title="Bancos"
                        subtitle="Cuentas bancarias de la empresa desde las que se paga a los proveedores"
                        actions={
                            <button type="button" className="btn-primary" onClick={openCreate}>
                                <i className="ri-add-line" aria-hidden /> Nuevo banco
                            </button>
                        }
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar bancos"
    ariaLabelledBy="banks-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                {!showEmpty && (
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
                        emptyLabel={totalItems === 0 ? "Sin bancos" : undefined}
                    />
                )}

                {loading ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                        Cargando bancos...
                    </div>
                ) : showEmpty ? (
                    <div className="purchases-empty">
                        <i className="ri-bank-card-line" />
                        <p>No hay bancos configurados. Agrega la cuenta desde la que pagarás a tus proveedores.</p>
                        <button className="btn-primary" type="button" onClick={openCreate}>
                            <i className="ri-add-line" /> Nuevo banco
                        </button>
                    </div>
                ) : showNoResults ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                        No hay bancos que coincidan con los filtros
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
                            isFetching={loading}
                            emptyLabel={totalItems === 0 ? "Sin bancos" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            {modalOpen && (
                <AppDrawer
                    title={editing ? "Editar banco" : "Nuevo banco"}
                    titleIcon={editing ? "ri-edit-line" : "ri-bank-line"}
                    onClose={() => setModalOpen(false)}
                    closeDisabled={saving}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setModalOpen(false)} disabled={saving}>
                                Cancelar
                            </button>
                            <button type="submit" form="bank-form" className="export-submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <i className="ri-loader-4-line rotating" aria-hidden />
                                        Guardando…
                                    </>
                                ) : (
                                    "Guardar"
                                )}
                            </button>
                        </>
                    }
                >
                    <form id="bank-form" className="supplier-drawer-form" onSubmit={(e) => void save(e)}>
                        <div className="led-form-grid">
                            <FilterField className="led-form-grid__full" label="Banco *" htmlFor="bank-nombre" icon="ri-bank-line">
                                <FieldControl
                                    id="bank-nombre"
                                    value={form.nombre_banco}
                                    onChange={(e) => set("nombre_banco", e.target.value)}
                                    placeholder="Bancolombia"
                                    disabled={saving}
                                    required
                                />
                            </FilterField>
                            <FilterField label="Número de cuenta *" htmlFor="bank-cuenta" icon="ri-bank-card-line">
                                <FieldControl
                                    id="bank-cuenta"
                                    value={form.numero_cuenta}
                                    onChange={(e) => set("numero_cuenta", e.target.value)}
                                    disabled={saving}
                                    required
                                />
                            </FilterField>
                            <FilterField label="Tipo de cuenta" htmlFor="bank-tipo" icon="ri-wallet-3-line">
                                <FieldControl as="select" id="bank-tipo" value={form.tipo_cuenta} onChange={(e) => set("tipo_cuenta", e.target.value)} disabled={saving}>
                                    <option value="corriente">Corriente</option>
                                    <option value="ahorros">Ahorros</option>
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Identificador (ACH)" htmlFor="bank-identificador" icon="ri-hashtag">
                                <FieldControl id="bank-identificador" value={form.identificador} onChange={(e) => set("identificador", e.target.value)} disabled={saving} />
                            </FilterField>
                            <FilterField label="Validación (ACH)" htmlFor="bank-validacion" icon="ri-shield-check-line">
                                <FieldControl id="bank-validacion" value={form.validacion_id} onChange={(e) => set("validacion_id", e.target.value)} disabled={saving} />
                            </FilterField>
                            <FilterField className="led-form-grid__full" label="Descripción del lote" htmlFor="bank-lote" icon="ri-file-text-line">
                                <FieldControl id="bank-lote" value={form.descripcion_lote} onChange={(e) => set("descripcion_lote", e.target.value)} disabled={saving} />
                            </FilterField>
                        </div>
                        <p className="pm-hint">
                            Identificador, validación y descripción son campos del archivo plano del banco (ACH). Usa los valores por defecto si no estás seguro.
                        </p>
                    </form>
                </AppDrawer>
            )}

            <ConfirmModal
                isOpen={!!toDelete}
                title="Eliminar banco"
                message={`¿Eliminar "${toDelete?.name}"?`}
                confirmText="Eliminar"
                onClose={() => setToDelete(null)}
                onConfirm={handleDelete}
                loading={deleting}
            />
        </ListPageShell>
    );
};

export default TreasuryBanksPage;
