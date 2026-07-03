import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import { getWarehouses, createWarehouse, updateWarehouse } from "../inventory.service";
import type { Warehouse } from "../inventory.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import {
    AppDrawer,
    PaginationToolbar,
    paginationRange,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";
import { normalizePageSize, PAGE_SIZE_OPTIONS } from "../inventoryFormat";
import { useInventoryFiltersPanel } from "../hooks/useInventoryFiltersPanel";

const emptyForm = {
    codigo: "",
    nombre: "",
    direccion: "",
    municipio: "",
    es_principal: false,
    estado: "activa" as Warehouse["estado"],
};

type EstadoFilter = "" | "activa" | "inactiva";

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "codigo", label: "Código", type: "text", icon: "ri-hashtag" },
    { id: "nombre", label: "Nombre", type: "text", icon: "ri-building-line", serverSide: true },
    { id: "municipio", label: "Municipio", type: "text", icon: "ri-map-pin-line" },
    { id: "direccion", label: "Dirección", type: "text", icon: "ri-road-map-line" },
    { id: "estado", label: "Estado", type: "select", icon: "ri-toggle-line", serverSide: true, options: [{ value: "activa", label: "Activa" }, { value: "inactiva", label: "Inactiva" }] },
];

const Bodegas: React.FC = () => {
    const [rows, setRows] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Warehouse | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [filterSearch, setFilterSearch] = useState("");
    const [filterEstado, setFilterEstado] = useState<EstadoFilter>("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const getRowFilterValue = useCallback((row: Warehouse, filterId: string): string => {
        switch (filterId) {
            case "codigo": return row.codigo ?? "";
            case "nombre": return row.nombre ?? "";
            case "municipio": return row.municipio ?? "";
            case "direccion": return row.direccion ?? "";
            case "estado": return row.estado ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || filterEstado !== "" || hasActiveClientFilters;

    useBodyScrollLock(modalOpen);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setRows(await getWarehouses());
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        const base = rows.filter((w) => {
            if (filterEstado === "activa" && w.estado !== "activa") return false;
            if (filterEstado === "inactiva" && w.estado !== "inactiva") return false;
            if (!q) return true;
            return (
                w.codigo.toLowerCase().includes(q) ||
                w.nombre.toLowerCase().includes(q) ||
                (w.municipio || "").toLowerCase().includes(q)
            );
        });
        return filterRows(base);
    }, [rows, debouncedSearch, filterEstado, filterRows]);

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, safePage, pageSize]);
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

    const handlePageChange = (next: number) => setPage(Math.max(1, Math.min(totalPages, next)));
    const handlePageSizeChange = (next: number) => {
        setPageSize(normalizePageSize(next));
        setPage(1);
    };
    const clearFilters = () => {
        setFilterSearch("");
        setFilterEstado("");
        clearColFilters();
    };

    const openNew = () => {
        setForm(emptyForm);
        setEditing(null);
        setModalOpen(true);
    };
    const openEdit = (w: Warehouse) => {
        setForm({
            codigo: w.codigo,
            nombre: w.nombre,
            direccion: w.direccion ?? "",
            municipio: w.municipio ?? "",
            es_principal: w.es_principal,
            estado: w.estado,
        });
        setEditing(w);
        setModalOpen(true);
    };

    const save = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!form.codigo.trim() || !form.nombre.trim()) {
            errorToast("Código y nombre son obligatorios");
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await updateWarehouse(editing._id, {
                    nombre: form.nombre.trim(),
                    direccion: form.direccion.trim() || undefined,
                    municipio: form.municipio.trim() || undefined,
                    es_principal: form.es_principal,
                    estado: form.estado,
                });
            } else {
                await createWarehouse({
                    codigo: form.codigo.trim(),
                    nombre: form.nombre.trim(),
                    direccion: form.direccion.trim() || undefined,
                    municipio: form.municipio.trim() || undefined,
                    es_principal: form.es_principal,
                });
            }
            successToast(editing ? "Bodega actualizada" : "Bodega creada");
            setModalOpen(false);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSaving(false);
        }
    };

    const { filtersToolbar, filtersMobileDrawer } = useInventoryFiltersPanel({
        panelId: "inv-bodegas",
        title: "Filtrar bodegas",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [filterSearch, filterEstado, colFilterValues],
        filterContent: (
            <>
                <FilterField label="Búsqueda" htmlFor="inv-bod-search" icon="ri-search-line">
                    <FieldControl
                        id="inv-bod-search"
                        type="text"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder="Código, nombre o municipio"
                    />
                </FilterField>
                <FilterField label="Estado" htmlFor="inv-bod-estado" icon="ri-toggle-line">
                    <FieldControl
                        id="inv-bod-estado"
                        as="select"
                        value={filterEstado}
                        onChange={(e) => setFilterEstado(e.target.value as EstadoFilter)}
                    >
                        <option value="">Todas</option>
                        <option value="activa">Activa</option>
                        <option value="inactiva">Inactiva</option>
                    </FieldControl>
                </FilterField>
                <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
            </>
        ),
    });

    const renderEstadoBadge = (w: Warehouse) => (
        <span className={`status-badge ${w.estado === "activa" ? "status-paid" : "status-rejected"}`}>
            {w.estado === "activa" ? "Activa" : "Inactiva"}
        </span>
    );

    const renderActions = (w: Warehouse, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            <button type="button" className="btn-action" title="Editar" onClick={() => openEdit(w)}>
                <i className="ri-edit-line" aria-hidden />
                {layout === "table" ? "Editar" : null}
            </button>
        </div>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Municipio</th>
                        <th>Dirección</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((w) => (
                        <tr key={w._id}>
                            <td data-label="Código">{w.codigo}</td>
                            <td data-label="Nombre">
                                {w.nombre}
                                {w.es_principal && <span className="acc-tag">Principal</span>}
                            </td>
                            <td data-label="Municipio">{w.municipio || "—"}</td>
                            <td data-label="Dirección">{w.direccion || "—"}</td>
                            <td data-label="Estado">{renderEstadoBadge(w)}</td>
                            <td data-label="Acciones">{renderActions(w)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((w) => (
                <article key={w._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{w.nombre}</strong>
                            {renderEstadoBadge(w)}
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{w.codigo}</strong>
                            {w.es_principal && <span className="acc-tag">Principal</span>}
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Municipio</dt>
                                <dd>{w.municipio || "—"}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Dirección</dt>
                                <dd>{w.direccion || "—"}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderActions(w, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((w) => (
                <article key={w._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{w.nombre}</strong>
                        {renderEstadoBadge(w)}
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{w.codigo}</strong>
                        {w.es_principal && <span className="acc-tag"> · Principal</span>}
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Municipio</dt>
                            <dd>{w.municipio || "—"}</dd>
                        </div>
                        <div className="purchases-card__field purchases-card__field--full">
                            <dt>Dirección</dt>
                            <dd>{w.direccion || "—"}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">{renderActions(w, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const showEmpty = !loading && rows.length === 0;
    const showNoResults = !loading && rows.length > 0 && totalItems === 0;
    const isNew = !editing;

    return (
        <div className="inv-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Centros de almacenamiento. La bodega principal se usa por defecto en los movimientos.
            </p>

            {filtersMobileDrawer}

            <div className="inv-section__toolbar">
                <button type="button" className="btn-primary" onClick={openNew}>
                    <i className="ri-add-line" aria-hidden /> Nueva bodega
                </button>
            </div>

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
                    emptyLabel={totalItems === 0 ? "Sin bodegas" : undefined}
                />
            )}

            {loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    Cargando bodegas…
                </div>
            ) : showEmpty ? (
                <div className="purchases-empty">
                    <i className="ri-building-line" />
                    <p>No hay bodegas. Crea la primera.</p>
                    <button type="button" className="btn-primary" onClick={openNew}>
                        <i className="ri-add-line" aria-hidden /> Nueva bodega
                    </button>
                </div>
            ) : showNoResults ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    No hay bodegas que coincidan con los filtros
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
                        emptyLabel={totalItems === 0 ? "Sin bodegas" : undefined}
                    />
                </>
            )}

            {modalOpen && (
                <AppDrawer
                    title={isNew ? "Nueva bodega" : "Editar bodega"}
                    titleIcon={isNew ? "ri-building-line" : "ri-edit-line"}
                    onClose={() => setModalOpen(false)}
                    closeDisabled={saving}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setModalOpen(false)} disabled={saving}>
                                Cancelar
                            </button>
                            <button type="submit" form="bodega-form" className="export-submit" disabled={saving}>
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
                    <form id="bodega-form" className="supplier-drawer-form" onSubmit={(e) => void save(e)}>
                        <div className="led-form-grid">
                            <FilterField label="Código *" htmlFor="bod-codigo" icon="ri-barcode-line">
                                <FieldControl
                                    id="bod-codigo"
                                    value={form.codigo}
                                    disabled={!isNew || saving}
                                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                                    placeholder="Ej. BOD-01"
                                    required
                                />
                            </FilterField>
                            <FilterField label="Nombre *" htmlFor="bod-nombre" icon="ri-store-2-line">
                                <FieldControl
                                    id="bod-nombre"
                                    value={form.nombre}
                                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                                    placeholder="Ej. Bodega principal"
                                    disabled={saving}
                                    required
                                />
                            </FilterField>
                            <FilterField label="Municipio" htmlFor="bod-municipio" icon="ri-map-pin-line">
                                <FieldControl
                                    id="bod-municipio"
                                    value={form.municipio}
                                    onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))}
                                    disabled={saving}
                                />
                            </FilterField>
                            <FilterField label="Dirección" htmlFor="bod-direccion" icon="ri-road-map-line">
                                <FieldControl
                                    id="bod-direccion"
                                    value={form.direccion}
                                    onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                                    disabled={saving}
                                />
                            </FilterField>
                            {!isNew && (
                                <FilterField label="Estado" htmlFor="bod-estado" icon="ri-toggle-line">
                                    <FieldControl
                                        as="select"
                                        id="bod-estado"
                                        value={form.estado}
                                        onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as Warehouse["estado"] }))}
                                        disabled={saving}
                                    >
                                        <option value="activa">Activa</option>
                                        <option value="inactiva">Inactiva</option>
                                    </FieldControl>
                                </FilterField>
                            )}
                            <FilterField className="led-form-grid__full" label="Marcar como bodega principal" htmlFor="bod-principal" icon="ri-star-line">
                                <FieldControl
                                    id="bod-principal"
                                    type="checkbox"
                                    checked={form.es_principal}
                                    onChange={(e) => setForm((f) => ({ ...f, es_principal: e.target.checked }))}
                                    disabled={saving}
                                />
                            </FilterField>
                        </div>
                    </form>
                </AppDrawer>
            )}
        </div>
    );
};

export default Bodegas;
