import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import "../../accounting/page/Configuration.css";
import "./FixedAssets.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAssets, createAsset, updateAsset, deleteAsset, importAssets, depreciate, disposeAsset, type FixedAsset } from "../assets.service";
import { downloadRowsXlsx, downloadRowsCsv, readSpreadsheet, type ColumnDef } from "../../accounting/import.utils";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    AppDrawer,
    AppModal,
    PaginationToolbar,
    FilterField,
    FieldControl,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    useEffectiveViewMode,
    useConfirm,
    type ViewMode,
} from "../../../components/design-system";
import { useLedgerFiltersPanel } from "../../ledger/hooks/useLedgerFiltersPanel";
import { useClientPagination } from "../../ledger/hooks/useClientPagination";
import { formatMoney, formatDate, todayIso } from "../../ledger/ledgerFormat";
import Attachments from "../../../components/shared/Attachments/Attachments";

const thisMonth = () => new Date().toISOString().slice(0, 7);
const ESTADO_BADGE: Record<string, string> = { activo: "status-paid", dado_de_baja: "status-rejected", vendido: "status-pending" };
const ESTADO_LABEL: Record<string, string> = { activo: "Activo", dado_de_baja: "Dado de baja", vendido: "Vendido" };

type EstadoFilter = "" | "activo" | "dado_de_baja" | "vendido";

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "costo", label: "Costo", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "depreciacion", label: "Dep. acum.", type: "number", icon: "ri-line-chart-line" },
    { id: "valor_libros", label: "Valor libros", type: "number", icon: "ri-scales-3-line" },
];

const COLS: ColumnDef[] = [
    { key: "codigo", header: "codigo", sample: "AF-001" },
    { key: "nombre", header: "nombre", sample: "Computador portátil" },
    { key: "categoria", header: "categoria", sample: "Equipo de cómputo" },
    { key: "usuario", header: "usuario", sample: "Alejandro" },
    { key: "ubicacion", header: "ubicacion", aliases: ["ubicación"], sample: "Piso 1" },
    { key: "fecha_adquisicion", header: "fecha_adquisicion", aliases: ["fecha_adquisicion", "fecha adquisicion"], sample: "2025-01-15" },
    { key: "costo", header: "costo", sample: "3000000" },
    { key: "valor_residual", header: "valor_residual", sample: "0" },
    { key: "vida_util_meses", header: "vida_util_meses", sample: "36" },
    { key: "tasa_depreciacion_anual", header: "vida_util_fiscal", aliases: ["vida util fiscal", "tasa", "tasa_depreciacion_anual"], sample: "20%" },
    { key: "cuenta_activo", header: "cuenta_activo", aliases: ["activo"], sample: "152835" },
    { key: "cuenta_depreciacion_acumulada", header: "cuenta_depreciacion_acumulada", aliases: ["depre acumulada", "depre_acumulada", "depreciacion acumulada cuenta"], sample: "159235" },
    { key: "cuenta_gasto_depreciacion", header: "cuenta_gasto_depreciacion", aliases: ["gasto depre", "gasto_depre"], sample: "516035" },
];

const emptyForm = {
    codigo: "", nombre: "", categoria: "", usuario: "", ubicacion: "", fecha_adquisicion: "", costo: "", valor_residual: "0",
    vida_util_meses: "", cuenta_activo: "", cuenta_depreciacion_acumulada: "", cuenta_gasto_depreciacion: "",
    metodo_depreciacion: "linea_recta", factor_decreciente: "2", unidades_vida_util: "",
};

const FixedAssetsPage: React.FC = () => {
    const { confirm } = useConfirm();
    const [assets, setAssets] = useState<FixedAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSearch, setFilterSearch] = useState("");
    const [filterEstado, setFilterEstado] = useState<EstadoFilter>("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const fileRef = useRef<HTMLInputElement>(null);

    const [periodo, setPeriodo] = useState(thisMonth());
    const [depreciating, setDepreciating] = useState(false);

    const [modal, setModal] = useState<FixedAsset | null | "new">(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

    const [disposeOf, setDisposeOf] = useState<FixedAsset | null>(null);
    const [disp, setDisp] = useState({ tipo: "venta" as "venta" | "baja", fecha: "", motivo: "", ventaValor: "", cuentaContrapartida: "", cuentaResultado: "" });
    const [disposing, setDisposing] = useState(false);

    useBodyScrollLock(!!modal);

    useRealtime(RealtimeEvents.ASSET_CHANGED, (p) => setAssets((prev) => applyRealtimeChange(prev as FixedAsset[], p) as FixedAsset[]));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const all: FixedAsset[] = [];
            let page = 1;
            let totalPages = 1;
            do {
                const res = await getAssets({ page });
                all.push(...res.assets);
                totalPages = res.pagination.totalPages || 1;
                page++;
            } while (page <= totalPages);
            setAssets(all);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [refreshKey]);

    useEffect(() => {
        load();
    }, [load]);

    const filteredAssets = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        return assets.filter((a) => {
            if (filterEstado && a.estado !== filterEstado) return false;
            if (!q) return true;
            return (
                a.codigo.toLowerCase().includes(q) ||
                a.nombre.toLowerCase().includes(q) ||
                (a.categoria || "").toLowerCase().includes(q) ||
                (a.usuario || "").toLowerCase().includes(q) ||
                (a.ubicacion || "").toLowerCase().includes(q)
            );
        });
    }, [assets, debouncedSearch, filterEstado]);
    const getRowFilterValue = useCallback((row: FixedAsset, filterId: string): string => {
        switch (filterId) {
            case "costo": return String(row.costo ?? 0);
            case "depreciacion": return String(row.depreciacion_acumulada ?? 0);
            case "valor_libros": return String((row.valor_libros ?? (row.costo - row.depreciacion_acumulada)) || 0);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedAssets = filterRows(filteredAssets);

    const {
        page,
        pageSize,
        totalItems,
        totalPages,
        paginated: paginatedAssets,
        start,
        end,
        handlePageChange,
        handlePageSizeChange,
        PAGE_SIZE_OPTIONS,
    } = useClientPagination(displayedAssets, [debouncedSearch, filterEstado, colFilterValues.costo, colFilterValues.depreciacion, colFilterValues.valor_libros]);

    const hasActiveFilters = filterSearch.trim() !== "" || filterEstado !== "" || hasActiveClientFilters;
    const clearFilters = () => {
        setFilterSearch("");
        setFilterEstado("");
        clearColFilters();
    };

    const { filtersToolbar, filtersMobileDrawer } = useLedgerFiltersPanel({
        panelId: "assets",
        title: "Filtrar activos",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [filterSearch, filterEstado],
        filterContent: (
            <>
                <FilterField label="Búsqueda" htmlFor="assets-filter-search" icon="ri-search-line">
                    <FieldControl
                        id="assets-filter-search"
                        type="text"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder="Código, nombre, categoría..."
                    />
                </FilterField>
                <FilterField label="Estado" htmlFor="assets-filter-estado" icon="ri-toggle-line">
                    <FieldControl
                        id="assets-filter-estado"
                        as="select"
                        value={filterEstado}
                        onChange={(e) => setFilterEstado(e.target.value as EstadoFilter)}
                    >
                        <option value="">Todos</option>
                        <option value="activo">Activos</option>
                        <option value="dado_de_baja">Dados de baja</option>
                        <option value="vendido">Vendidos</option>
                    </FieldControl>
                </FilterField>
                <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="assets-col" />
            </>
        ),
    });

    const runDepreciation = async () => {
        if (!(await confirm(`¿Contabilizar la depreciación de ${periodo} para los activos activos?`))) return;
        setDepreciating(true);
        try {
            const res = await depreciate(periodo);
            successToast(res.message);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setDepreciating(false);
        }
    };

    const openNew = () => {
        setForm(emptyForm);
        setModal("new");
    };

    const openEdit = (a: FixedAsset) => {
        setForm({
            codigo: a.codigo,
            nombre: a.nombre,
            categoria: a.categoria ?? "",
            usuario: a.usuario ?? "",
            ubicacion: a.ubicacion ?? "",
            fecha_adquisicion: a.fecha_adquisicion ? new Date(a.fecha_adquisicion).toISOString().slice(0, 10) : "",
            costo: String(a.costo),
            valor_residual: String(a.valor_residual),
            vida_util_meses: String(a.vida_util_meses),
            cuenta_activo: a.cuenta_activo,
            cuenta_depreciacion_acumulada: a.cuenta_depreciacion_acumulada,
            cuenta_gasto_depreciacion: a.cuenta_gasto_depreciacion,
            metodo_depreciacion: a.metodo_depreciacion ?? "linea_recta",
            factor_decreciente: String(a.factor_decreciente ?? 2),
            unidades_vida_util: a.unidades_vida_util ? String(a.unidades_vida_util) : "",
        });
        setModal(a);
    };

    const save = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!form.codigo || !form.nombre || !form.costo || !form.vida_util_meses || !form.fecha_adquisicion) {
            errorToast("Código, nombre, costo, vida útil y fecha son obligatorios");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                codigo: form.codigo.trim(),
                nombre: form.nombre.trim(),
                categoria: form.categoria.trim() || undefined,
                usuario: form.usuario.trim() || undefined,
                ubicacion: form.ubicacion.trim() || undefined,
                fecha_adquisicion: form.fecha_adquisicion,
                costo: Number(form.costo) || 0,
                valor_residual: Number(form.valor_residual) || 0,
                vida_util_meses: Number(form.vida_util_meses) || 0,
                cuenta_activo: form.cuenta_activo.trim(),
                cuenta_depreciacion_acumulada: form.cuenta_depreciacion_acumulada.trim(),
                cuenta_gasto_depreciacion: form.cuenta_gasto_depreciacion.trim(),
                metodo_depreciacion: form.metodo_depreciacion as FixedAsset["metodo_depreciacion"],
                factor_decreciente: Number(form.factor_decreciente) || 2,
                unidades_vida_util: Number(form.unidades_vida_util) || 0,
            };
            if (modal && modal !== "new") await updateAsset(modal._id, payload);
            else await createAsset(payload);
            successToast(modal === "new" ? "Activo creado" : "Activo actualizado");
            setModal(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await deleteAsset(toDelete.id);
            successToast("Activo eliminado");
            setToDelete(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const onImport = async (file: File | null) => {
        if (!file) return;
        try {
            const rows = await readSpreadsheet(file, COLS);
            const numero = (s: string) => {
                let t = String(s ?? "").trim().replace(/[%$\s]/g, "");
                if (!t) return 0;
                if (/e/i.test(t)) {
                    const n = Number(t);
                    return Number.isFinite(n) ? n : 0;
                }
                const hasComma = t.includes(","),
                    hasDot = t.includes(".");
                if (hasComma && hasDot) {
                    const decSep = t.lastIndexOf(",") > t.lastIndexOf(".") ? "," : ".";
                    const thouSep = decSep === "," ? "." : ",";
                    t = t.split(thouSep).join("").replace(decSep, ".");
                } else if (hasComma || hasDot) {
                    const sep = hasComma ? "," : ".";
                    const parts = t.split(sep);
                    const isThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
                    t = isThousands ? parts.join("") : t.replace(sep, ".");
                }
                const n = Number(t);
                return Number.isFinite(n) ? n : 0;
            };
            const valid = rows
                .filter((r) => (r.codigo || "").trim() && r.codigo !== "AF-001")
                .map((r) => ({
                    codigo: r.codigo,
                    nombre: r.nombre,
                    categoria: r.categoria,
                    usuario: r.usuario,
                    ubicacion: r.ubicacion,
                    fecha_adquisicion: r.fecha_adquisicion,
                    costo: numero(r.costo),
                    valor_residual: numero(r.valor_residual),
                    vida_util_meses: Number(r.vida_util_meses) || 0,
                    tasa_depreciacion_anual: numero(r.tasa_depreciacion_anual),
                    cuenta_activo: r.cuenta_activo,
                    cuenta_depreciacion_acumulada: r.cuenta_depreciacion_acumulada,
                    cuenta_gasto_depreciacion: r.cuenta_gasto_depreciacion,
                }));
            if (!valid.length) {
                errorToast("No se encontraron activos válidos en el archivo");
                return;
            }
            const res = await importAssets(valid as Parameters<typeof importAssets>[0]);
            successToast(`${res.importados} activo(s) importado(s)`);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al importar");
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const downloadTemplate = (kind: "xlsx" | "csv") => {
        const headers = COLS.map((c) => c.header);
        const guide = [COLS.map((c) => c.sample ?? "")];
        if (kind === "xlsx") downloadRowsXlsx("plantilla-activos-fijos.xlsx", headers, guide);
        else downloadRowsCsv("plantilla-activos-fijos.csv", headers, guide);
    };

    const openDispose = (a: FixedAsset) => {
        setDisposeOf(a);
        setDisp({ tipo: "venta", fecha: todayIso(), motivo: "", ventaValor: "", cuentaContrapartida: "", cuentaResultado: "" });
    };

    const runDispose = async () => {
        if (!disposeOf) return;
        if (!disp.cuentaResultado) {
            errorToast("Indica la cuenta de resultado (utilidad/pérdida)");
            return;
        }
        if (disp.tipo === "venta" && !disp.cuentaContrapartida) {
            errorToast("Indica la cuenta de banco/CxC de la venta");
            return;
        }
        setDisposing(true);
        try {
            const res = await disposeAsset(disposeOf._id, {
                tipo: disp.tipo,
                fecha: disp.fecha || undefined,
                motivo: disp.motivo || undefined,
                ventaValor: Number(disp.ventaValor) || 0,
                cuentaContrapartida: disp.cuentaContrapartida || undefined,
                cuentaResultado: disp.cuentaResultado,
            });
            successToast(res.message);
            setDisposeOf(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setDisposing(false);
        }
    };

    const valorLibros = (a: FixedAsset) => a.valor_libros ?? a.costo - a.depreciacion_acumulada;

    const renderEstadoBadge = (a: FixedAsset) => (
        <span className={`status-badge ${ESTADO_BADGE[a.estado]}`}>{ESTADO_LABEL[a.estado]}</span>
    );

    const renderSubline = (a: FixedAsset) => (
        <>
            {a.categoria} · {a.vida_util_meses}m
            {a.tasa_depreciacion_anual ? ` (${a.tasa_depreciacion_anual}%)` : ""} · adq. {formatDate(a.fecha_adquisicion)}
            {a.usuario ? ` · ${a.usuario}` : ""}
            {a.ubicacion ? ` · ${a.ubicacion}` : ""}
        </>
    );

    const renderActions = (a: FixedAsset, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            {a.estado === "activo" && (
                <>
                    <button type="button" className="btn-action" title="Editar" onClick={() => openEdit(a)}>
                        <i className="ri-edit-line" aria-hidden />
                        {layout === "table" ? "Editar" : null}
                    </button>
                    <button type="button" className="btn-action" title="Baja / venta" onClick={() => openDispose(a)}>
                        <i className="ri-logout-box-r-line" aria-hidden />
                        {layout === "table" ? "Baja / venta" : null}
                    </button>
                    {a.depreciacion_acumulada === 0 && (
                        <button type="button" className="btn-action" title="Eliminar" onClick={() => setToDelete({ id: a._id, name: a.nombre })}>
                            <i className="ri-delete-bin-line" aria-hidden />
                            {layout === "table" ? "Eliminar" : null}
                        </button>
                    )}
                </>
            )}
        </div>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th className="ds-num">Costo</th>
                        <th className="ds-num">Dep. acum.</th>
                        <th className="ds-num">Valor libros</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedAssets.map((a) => (
                        <tr key={a._id}>
                            <td data-label="Código">{a.codigo}</td>
                            <td data-label="Nombre">
                                {a.nombre}
                                <br />
                                <span style={{ color: "var(--text-muted)", fontSize: ".8rem" }}>{renderSubline(a)}</span>
                            </td>
                            <td data-label="Costo" className="ds-num">{formatMoney(a.costo)}</td>
                            <td data-label="Dep. acum." className="ds-num">{formatMoney(a.depreciacion_acumulada)}</td>
                            <td data-label="Valor libros" className="ds-num"><strong>{formatMoney(valorLibros(a))}</strong></td>
                            <td data-label="Estado">{renderEstadoBadge(a)}</td>
                            <td data-label="Acciones">{renderActions(a)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginatedAssets.map((a) => (
                <article key={a._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{a.codigo} — {a.nombre}</strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(valorLibros(a))}</span>
                        </div>
                        <div className="purchases-list-item__sub">{renderSubline(a)}</div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field"><dt>Costo</dt><dd>{formatMoney(a.costo)}</dd></div>
                            <div className="purchases-list-item__field"><dt>Dep. acum.</dt><dd>{formatMoney(a.depreciacion_acumulada)}</dd></div>
                            <div className="purchases-list-item__field"><dt>Estado</dt><dd>{renderEstadoBadge(a)}</dd></div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderActions(a, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginatedAssets.map((a) => (
                <article key={a._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{a.codigo}</strong>
                        {renderEstadoBadge(a)}
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{a.nombre}</strong>
                    </div>
                    <div className="purchases-card__sub" style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>{renderSubline(a)}</div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field"><dt>Costo</dt><dd>{formatMoney(a.costo)}</dd></div>
                        <div className="purchases-card__field"><dt>Dep. acum.</dt><dd>{formatMoney(a.depreciacion_acumulada)}</dd></div>
                        <div className="purchases-card__field purchases-card__field--full"><dt>Valor libros</dt><dd><strong>{formatMoney(valorLibros(a))}</strong></dd></div>
                    </dl>
                    <footer className="purchases-card__actions">{renderActions(a, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const showEmpty = !loading && assets.length === 0;
    const showNoResults = !loading && assets.length > 0 && totalItems === 0;

    return (
        <ListPageShell className="purchases-page af-page">
            <ListPageContainer className="purchases-container">
                <ListPageHeader
                    className="purchases-header"
                    title="Activos fijos"
                    subtitle="Ficha, depreciación (línea recta) y baja/venta de activos"
                    actions={
                        <>
                            <button type="button" className="btn-secondary" onClick={() => downloadTemplate("xlsx")}>
                                <i className="ri-file-excel-2-line" aria-hidden /> Plantilla
                            </button>
                            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                                <i className="ri-upload-2-line" aria-hidden /> Importar
                            </button>
                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onImport(e.target.files?.[0] ?? null)} />
                            <button type="button" className="btn-primary" onClick={openNew}>
                                <i className="ri-add-line" aria-hidden /> Nuevo activo
                            </button>
                        </>
                    }
                />

                <div className="af-depreciate-bar">
                    <div className="af-depreciate-bar__field">
                        <FilterField label="Depreciar período" htmlFor="af-periodo" icon="ri-calendar-line">
                            <FieldControl id="af-periodo" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
                        </FilterField>
                    </div>
                    <button type="button" className="btn-primary af-depreciate-bar__action" onClick={runDepreciation} disabled={depreciating}>
                        {depreciating ? "Contabilizando..." : "Contabilizar depreciación"}
                    </button>
                </div>

                {filtersMobileDrawer}

                {!showEmpty && (
                    <PaginationToolbar
                        position="top"
                        page={page}
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
                    />
                )}

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando activos...</div>
                ) : showEmpty ? (
                    <div className="purchases-empty">
                        <i className="ri-computer-line" aria-hidden />
                        <p>No hay activos fijos. Crea uno o importa desde Excel.</p>
                        <button type="button" className="btn-primary" onClick={openNew}>
                            <i className="ri-add-line" aria-hidden /> Nuevo activo
                        </button>
                    </div>
                ) : showNoResults ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                        No hay activos que coincidan con los filtros
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
                            isFetching={loading}
                        />
                    </>
                )}
            </ListPageContainer>

            {modal && (
                <AppDrawer
                    wide
                    title={modal === "new" ? "Nuevo activo" : "Editar activo"}
                    titleIcon={modal === "new" ? "ri-add-line" : "ri-edit-line"}
                    onClose={() => setModal(null)}
                    closeDisabled={saving}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setModal(null)} disabled={saving}>
                                Cancelar
                            </button>
                            <button type="submit" form="asset-form" className="export-submit" disabled={saving}>
                                {saving ? "Guardando..." : "Guardar"}
                            </button>
                        </>
                    }
                >
                    <form id="asset-form" className="supplier-drawer-form" onSubmit={(e) => void save(e)}>
                        <div className="led-form-grid">
                            <FilterField label="Código *" htmlFor="af-codigo" icon="ri-barcode-line">
                                <FieldControl id="af-codigo" value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} />
                            </FilterField>
                            <FilterField label="Categoría" htmlFor="af-categoria" icon="ri-folder-line">
                                <FieldControl id="af-categoria" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
                            </FilterField>
                            <FilterField className="led-form-grid__full" label="Nombre *" htmlFor="af-nombre" icon="ri-price-tag-3-line">
                                <FieldControl id="af-nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
                            </FilterField>
                            <FilterField label="Usuario / responsable" htmlFor="af-usuario" icon="ri-user-line">
                                <FieldControl id="af-usuario" value={form.usuario} onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))} placeholder="Ej. Alejandro" />
                            </FilterField>
                            <FilterField label="Ubicación" htmlFor="af-ubicacion" icon="ri-map-pin-line">
                                <FieldControl id="af-ubicacion" value={form.ubicacion} onChange={(e) => setForm((f) => ({ ...f, ubicacion: e.target.value }))} placeholder="Ej. Piso 1" />
                            </FilterField>
                            <FilterField label="Fecha adquisición *" htmlFor="af-fecha" icon="ri-calendar-line">
                                <FieldControl id="af-fecha" type="date" value={form.fecha_adquisicion} onChange={(e) => setForm((f) => ({ ...f, fecha_adquisicion: e.target.value }))} />
                            </FilterField>
                            <FilterField label="Costo *" htmlFor="af-costo" icon="ri-money-dollar-circle-line">
                                <FieldControl id="af-costo" type="number" value={form.costo} onChange={(e) => setForm((f) => ({ ...f, costo: e.target.value }))} />
                            </FilterField>
                            <FilterField label="Valor residual" htmlFor="af-residual" icon="ri-money-dollar-box-line">
                                <FieldControl id="af-residual" type="number" value={form.valor_residual} onChange={(e) => setForm((f) => ({ ...f, valor_residual: e.target.value }))} />
                            </FilterField>
                            <FilterField label="Vida útil (meses) *" htmlFor="af-vida" icon="ri-time-line">
                                <FieldControl id="af-vida" type="number" value={form.vida_util_meses} onChange={(e) => setForm((f) => ({ ...f, vida_util_meses: e.target.value }))} />
                            </FilterField>
                            <FilterField label="Método de depreciación" htmlFor="af-metodo" icon="ri-line-chart-line">
                                <FieldControl as="select" id="af-metodo" value={form.metodo_depreciacion} onChange={(e) => setForm((f) => ({ ...f, metodo_depreciacion: e.target.value }))}>
                                    <option value="linea_recta">Línea recta</option>
                                    <option value="saldos_decrecientes">Saldos decrecientes</option>
                                    <option value="unidades_producidas">Unidades producidas</option>
                                </FieldControl>
                            </FilterField>
                            {form.metodo_depreciacion === "saldos_decrecientes" && (
                                <FilterField label="Factor decreciente" htmlFor="af-factor" icon="ri-percent-line">
                                    <FieldControl id="af-factor" type="number" step="0.1" value={form.factor_decreciente} onChange={(e) => setForm((f) => ({ ...f, factor_decreciente: e.target.value }))} title="Ej. 2 = doble saldo decreciente" />
                                </FilterField>
                            )}
                            {form.metodo_depreciacion === "unidades_producidas" && (
                                <FilterField label="Unidades vida útil" htmlFor="af-unidades" icon="ri-stack-line">
                                    <FieldControl id="af-unidades" type="number" value={form.unidades_vida_util} onChange={(e) => setForm((f) => ({ ...f, unidades_vida_util: e.target.value }))} title="Capacidad total estimada de unidades" />
                                </FilterField>
                            )}
                            <FilterField label="Cuenta activo" htmlFor="af-cuenta-activo" icon="ri-hashtag">
                                <FieldControl id="af-cuenta-activo" value={form.cuenta_activo} onChange={(e) => setForm((f) => ({ ...f, cuenta_activo: e.target.value }))} placeholder="Ej. 152835" />
                            </FilterField>
                            <FilterField label="Cuenta deprec. acumulada" htmlFor="af-cuenta-depre" icon="ri-hashtag">
                                <FieldControl id="af-cuenta-depre" value={form.cuenta_depreciacion_acumulada} onChange={(e) => setForm((f) => ({ ...f, cuenta_depreciacion_acumulada: e.target.value }))} placeholder="Ej. 159235" />
                            </FilterField>
                            <FilterField className="led-form-grid__full" label="Cuenta gasto depreciación" htmlFor="af-cuenta-gasto" icon="ri-hashtag">
                                <FieldControl id="af-cuenta-gasto" value={form.cuenta_gasto_depreciacion} onChange={(e) => setForm((f) => ({ ...f, cuenta_gasto_depreciacion: e.target.value }))} placeholder="Ej. 516035" />
                            </FilterField>
                        </div>
                        {form.costo && form.vida_util_meses && (
                            <p className="pm-hint">
                                Cuota mensual estimada:{" "}
                                <strong>{formatMoney((Number(form.costo) - Number(form.valor_residual || 0)) / (Number(form.vida_util_meses) || 1))}</strong>
                            </p>
                        )}
                        {modal !== "new" && (
                            <div style={{ marginTop: 16, borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
                                <Attachments entidad="activo" entidadId={modal._id} titulo="Soportes del activo" />
                            </div>
                        )}
                    </form>
                </AppDrawer>
            )}

            {disposeOf && (
                <AppModal
                    title={`Baja / venta — ${disposeOf.nombre}`}
                    onClose={() => setDisposeOf(null)}
                    closeDisabled={disposing}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setDisposeOf(null)} disabled={disposing}>Cancelar</button>
                            <button type="button" className="export-submit" onClick={runDispose} disabled={disposing}>{disposing ? "Procesando..." : "Confirmar y contabilizar"}</button>
                        </>
                    }
                >
                    <p className="pm-hint">Valor en libros: <strong>{formatMoney(valorLibros(disposeOf))}</strong></p>
                    <div className="led-form-grid">
                        <FilterField label="Tipo" htmlFor="af-disp-tipo" icon="ri-exchange-line">
                            <FieldControl as="select" id="af-disp-tipo" value={disp.tipo} onChange={(e) => setDisp((d) => ({ ...d, tipo: e.target.value as "venta" | "baja" }))}>
                                <option value="venta">Venta</option>
                                <option value="baja">Baja</option>
                            </FieldControl>
                        </FilterField>
                        <FilterField label="Fecha" htmlFor="af-disp-fecha" icon="ri-calendar-line">
                            <FieldControl id="af-disp-fecha" type="date" value={disp.fecha} onChange={(e) => setDisp((d) => ({ ...d, fecha: e.target.value }))} />
                        </FilterField>
                        {disp.tipo === "venta" && (
                            <>
                                <FilterField label="Valor de venta" htmlFor="af-disp-venta" icon="ri-money-dollar-circle-line">
                                    <FieldControl id="af-disp-venta" type="number" value={disp.ventaValor} onChange={(e) => setDisp((d) => ({ ...d, ventaValor: e.target.value }))} />
                                </FilterField>
                                <FilterField label="Cuenta banco/CxC" htmlFor="af-disp-contra" icon="ri-bank-card-line">
                                    <FieldControl id="af-disp-contra" value={disp.cuentaContrapartida} onChange={(e) => setDisp((d) => ({ ...d, cuentaContrapartida: e.target.value }))} placeholder="Ej. 111005" />
                                </FilterField>
                            </>
                        )}
                        <FilterField className="led-form-grid__full" label="Cuenta resultado (utilidad/pérdida) *" htmlFor="af-disp-resultado" icon="ri-hashtag">
                            <FieldControl id="af-disp-resultado" value={disp.cuentaResultado} onChange={(e) => setDisp((d) => ({ ...d, cuentaResultado: e.target.value }))} placeholder="Ej. 424540 / 531005" />
                        </FilterField>
                        <FilterField className="led-form-grid__full" label="Motivo" htmlFor="af-disp-motivo" icon="ri-file-text-line">
                            <FieldControl id="af-disp-motivo" value={disp.motivo} onChange={(e) => setDisp((d) => ({ ...d, motivo: e.target.value }))} />
                        </FilterField>
                    </div>
                </AppModal>
            )}

            <ConfirmModal isOpen={!!toDelete} title="Eliminar activo" message={`¿Eliminar "${toDelete?.name}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={handleDelete} />
        </ListPageShell>
    );
};

export default FixedAssetsPage;
