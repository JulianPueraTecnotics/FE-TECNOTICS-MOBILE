import { useCallback, useEffect, useRef, useState } from "react";
import { getCoa, importCoa, importCoaTemplate } from "../accounting.service";
import type { CoaAccount, CoaTemplateRow } from "../accounting.types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { downloadRowsXlsx, downloadRowsCsv, readFirstColumn, readSpreadsheet } from "../import.utils";
import {
    PaginationToolbar,
    paginationRange,
    useEffectiveViewMode,
    FilterField,
    FieldControl,
    useListFiltersPanel,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";
import "../../clients/page/Clients.css";
import "../../purchases/page/Purchases.css";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

const VENC_LABEL: Record<string, string> = { no: "No", cartera: "Cartera", proveedores: "Proveedores" };

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "codigo", label: "Código", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "nombre", label: "Nombre", type: "text", icon: "ri-file-text-line", serverSide: true },
    { id: "clase", label: "Clase", type: "text", icon: "ri-book-2-line" },
    { id: "categoria", label: "Categoría", type: "text", icon: "ri-folder-3-line" },
    { id: "naturaleza", label: "Naturaleza", type: "select", icon: "ri-scales-3-line", options: [{ value: "DEBITO", label: "Débito" }, { value: "CREDITO", label: "Crédito" }] },
    { id: "tipo", label: "Tipo", type: "select", icon: "ri-node-tree", options: [{ value: "auxiliar", label: "Auxiliar" }, { value: "mayor", label: "Mayor" }] },
    { id: "vencimientos", label: "Vencimientos", type: "text", icon: "ri-calendar-check-line" },
    { id: "padre", label: "Padre", type: "text", icon: "ri-git-branch-line" },
];

/**
 * Plan único de cuentas (PUC). Importa/exporta el catálogo desde la plantilla
 * "Cuentas contables.xlsx", que trae TODAS las columnas funcionales:
 *
 *   Código | Nombre | Categoría | Clase | Relación con | Maneja vencimientos |
 *   Diferencia fiscal | Activo | Nivel agrupación
 *
 * La tabla muestra el detalle completo (nombre, clase, categoría, naturaleza...).
 * Mantiene compatibilidad con archivos viejos de una sola columna de códigos.
 */

/** Columnas de la plantilla completa (header tal cual en el Excel del usuario). */
const TEMPLATE_COLUMNS = [
    { key: "codigo", header: "Código" },
    { key: "nombre", header: "Nombre" },
    { key: "categoria", header: "Categoría" },
    { key: "clase", header: "Clase" },
    { key: "relacion_con", header: "Relación con" },
    { key: "maneja_vencimientos", header: "Maneja vencimientos" },
    { key: "diferencia_fiscal", header: "Diferencia fiscal" },
    { key: "activo", header: "Activo" },
    { key: "nivel_agrupacion", header: "Nivel agrupación" },
] as const;

const TEMPLATE_HEADERS = TEMPLATE_COLUMNS.map((c) => c.header);
/** Filas de ejemplo para la plantilla descargable. */
const TEMPLATE_EXAMPLE: string[][] = [
    ["1", "Activo", "", "", "", "", "", "", ""],
    ["11", "Efectivo y equivalentes de efectivo", "", "", "", "", "", "", ""],
    ["1105", "Caja", "", "", "", "", "", "", ""],
    ["110505", "Caja general", "", "", "", "", "", "", ""],
    ["11050501", "Caja general", "Caja - Bancos", "Activo", "Formas de pago", "No maneja vencimiento", "No", "Sí", "Transaccional"],
];

/** ¿La celda es un código de cuenta (solo dígitos)? */
const isCode = (v: string) => /^\d{1,}$/.test(v.replace(/\s/g, ""));

/** Deduce el nivel del PUC por la longitud del código (1,2,4,6,8 → 1..5). */
function levelFromCode(code: string): number {
    const len = code.length;
    if (len <= 1) return 1;
    if (len <= 2) return 2;
    if (len <= 4) return 3;
    if (len <= 6) return 4;
    return 5;
}

/** Código del padre por jerarquía PUC (longitudes 1,2,4,6,8). */
function parentCode(code: string): string | null {
    const len = code.length;
    if (len <= 1) return null;
    if (len <= 2) return code.slice(0, 1);
    if (len <= 4) return code.slice(0, 2);
    if (len <= 6) return code.slice(0, 4);
    if (len <= 8) return code.slice(0, 6);
    return code.slice(0, 8);
}

const Puc: React.FC = () => {
    const [accounts, setAccounts] = useState<CoaAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(50);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [importing, setImporting] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const fileRef = useRef<HTMLInputElement>(null);

    const getRowFilterValue = useCallback((row: CoaAccount, filterId: string): string => {
        switch (filterId) {
            case "codigo": return row.codigo ?? "";
            case "nombre": return row.nombre ?? "";
            case "clase": return row.clase ?? "";
            case "categoria": return row.categoria ?? "";
            case "naturaleza": return row.naturaleza ?? "";
            case "tipo": return row.es_movimiento ? "auxiliar" : "mayor";
            case "vencimientos": return VENC_LABEL[row.maneja_vencimientos ?? "no"] ?? "No";
            case "padre": return row.codigo_padre ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedAccounts = filterRows(accounts);
    const hasActiveFilters = search.trim() !== "" || hasActiveClientFilters;

    const load = useCallback(async () => {
        const hasData = accounts.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        try {
            const res = await getCoa(page, pageSize, debouncedSearch.trim());
            setAccounts(res.accounts);
            setTotalPages(res.pagination.totalPages);
            setTotal(res.pagination.total);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
            setIsPageFetching(false);
        }
    }, [page, pageSize, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (page !== 1) setPage(1);
    }, [debouncedSearch, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePageChange = (nextPage: number) => {
        setPage(Math.max(1, Math.min(totalPages, nextPage)));
    };

    const handlePageSizeChange = (nextSize: number) => {
        setPageSize(nextSize);
        setPage(1);
    };

    const clearFilters = () => {
        setSearch("");
        clearColFilters();
    };

    const { filtersToolbar, filtersMobileDrawer } = useListFiltersPanel({
        panelId: "puc",
        title: "Filtrar PUC",
        variant: "clients",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [search, colFilterValues],
        filterContent: (
            <>
                <FilterField label="Búsqueda" htmlFor="puc-search" icon="ri-search-line">
                    <FieldControl
                        id="puc-search"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Código o nombre"
                    />
                </FilterField>
                <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
            </>
        ),
    });

    const { start, end } = paginationRange(page, pageSize, total);

    const renderAccountFields = (a: CoaAccount) => ({
        codigo: a.codigo,
        nombre: a.nombre,
        clase: a.clase ?? "—",
        categoria: a.categoria ?? "—",
        naturaleza: a.naturaleza === "DEBITO" ? "Débito" : a.naturaleza === "CREDITO" ? "Crédito" : "—",
        tipo: a.es_movimiento ? "Auxiliar" : "Mayor",
        venc: VENC_LABEL[a.maneja_vencimientos ?? "no"] ?? "No",
        padre: a.codigo_padre ?? "—",
    });

    const renderTable = () => (
        <div className="clients-table-container ds-table-container">
            <table className="clients-table ds-table">
                <thead>
                    <tr>
                        <th>Código</th><th>Nombre</th><th>Clase</th><th>Categoría</th><th>Naturaleza</th><th>Tipo</th><th>Vencimientos</th><th>Padre</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedAccounts.map((a) => {
                        const f = renderAccountFields(a);
                        return (
                            <tr key={a._id}>
                                <td data-label="Código" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{f.codigo}</td>
                                <td data-label="Nombre">{f.nombre}</td>
                                <td data-label="Clase">{f.clase}</td>
                                <td data-label="Categoría">{f.categoria}</td>
                                <td data-label="Naturaleza">{f.naturaleza}</td>
                                <td data-label="Tipo">{f.tipo}</td>
                                <td data-label="Vencimientos">{f.venc}</td>
                                <td data-label="Padre">{f.padre}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="clients-list-view">
            {displayedAccounts.map((a) => {
                const f = renderAccountFields(a);
                return (
                    <article key={a._id} className="clients-list-item">
                        <div className="clients-list-item__body">
                            <div className="clients-list-item__head">
                                <strong className="clients-list-item__name">{f.codigo} — {f.nombre}</strong>
                            </div>
                            <dl className="clients-list-item__fields">
                                <div className="clients-list-item__field"><dt>Clase</dt><dd>{f.clase}</dd></div>
                                <div className="clients-list-item__field"><dt>Categoría</dt><dd>{f.categoria}</dd></div>
                                <div className="clients-list-item__field"><dt>Naturaleza</dt><dd>{f.naturaleza}</dd></div>
                                <div className="clients-list-item__field"><dt>Tipo</dt><dd>{f.tipo}</dd></div>
                            </dl>
                        </div>
                    </article>
                );
            })}
        </div>
    );

    const renderCards = () => (
        <div className="clients-cards-view">
            {displayedAccounts.map((a) => {
                const f = renderAccountFields(a);
                return (
                    <article key={a._id} className="clients-card">
                        <div className="clients-card__body">
                            <div className="clients-card__header">
                                <strong className="clients-card__name">{f.codigo}</strong>
                            </div>
                            <dl className="clients-card__fields">
                                <div className="clients-card__field"><dt>Nombre</dt><dd>{f.nombre}</dd></div>
                                <div className="clients-card__field"><dt>Clase</dt><dd>{f.clase}</dd></div>
                                <div className="clients-card__field"><dt>Categoría</dt><dd>{f.categoria}</dd></div>
                            </dl>
                        </div>
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

    /** Descarga la plantilla completa (con encabezados y filas de ejemplo). */
    const downloadTemplate = (kind: "xlsx" | "csv") => {
        if (kind === "xlsx") downloadRowsXlsx("plantilla-cuentas-contables.xlsx", TEMPLATE_HEADERS, TEMPLATE_EXAMPLE, "Cuentas contables");
        else downloadRowsCsv("plantilla-cuentas-contables.csv", TEMPLATE_HEADERS, TEMPLATE_EXAMPLE);
    };

    /** Exporta TODO el PUC actual con el detalle completo (mismas columnas de la plantilla). */
    const exportCoa = async (kind: "xlsx" | "csv") => {
        try {
            const all: CoaAccount[] = [];
            let p = 1;
            for (;;) {
                const res = await getCoa(p, 200, "");
                all.push(...res.accounts);
                if (p >= res.pagination.totalPages) break;
                p++;
            }
            if (!all.length) {
                errorToast("No hay cuentas para exportar");
                return;
            }
            const rows = all
                .sort((a, b) => a.codigo.localeCompare(b.codigo))
                .map((a) => [
                    a.codigo,
                    a.nombre,
                    a.categoria ?? "",
                    a.clase ?? "",
                    a.relacion_con ?? "",
                    VENC_LABEL[a.maneja_vencimientos ?? "no"] ?? "No",
                    a.diferencia_fiscal ? "Sí" : "No",
                    a.estado === "ACTIVA" ? "Sí" : "No",
                    a.es_movimiento ? "Transaccional" : "Agrupación",
                ]);
            if (kind === "xlsx") downloadRowsXlsx("cuentas-contables.xlsx", TEMPLATE_HEADERS, rows, "Cuentas contables");
            else downloadRowsCsv("cuentas-contables.csv", TEMPLATE_HEADERS, rows);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al exportar");
        }
    };

    const onFile = async (file: File | null) => {
        if (!file) return;
        setImporting(true);
        try {
            const records = await readSpreadsheet(file, TEMPLATE_COLUMNS as unknown as { key: string; header: string }[]);
            const conNombre = records.filter((r) => isCode(r.codigo) && r.nombre.trim());

            if (conNombre.length) {
                const rows: CoaTemplateRow[] = conNombre.map((r) => ({
                    codigo: r.codigo.trim(),
                    nombre: r.nombre.trim(),
                    categoria: r.categoria,
                    clase: r.clase,
                    relacion_con: r.relacion_con,
                    maneja_vencimientos: r.maneja_vencimientos,
                    diferencia_fiscal: r.diferencia_fiscal,
                    activo: r.activo,
                    nivel_agrupacion: r.nivel_agrupacion,
                }));
                const res = await importCoaTemplate(rows);
                successToast(`${res.importadas} cuenta(s) importada(s)`);
            } else {
                const cells = await readFirstColumn(file);
                const codes = [...new Set(cells.filter(isCode))];
                if (!codes.length) {
                    errorToast("No se encontraron cuentas en el archivo. Descarga la plantilla para ver el formato.");
                    return;
                }
                const rows: Partial<CoaAccount>[] = codes.map((codigo) => ({ codigo, nombre: codigo, nivel: levelFromCode(codigo), codigo_padre: parentCode(codigo) }));
                const res = await importCoa(rows);
                successToast(`${res.importadas} cuenta(s) importada(s) (solo códigos, sin nombre)`);
            }
            setPage(1);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al importar");
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Plan único de cuentas (PUC)</h2>
                    <p className="acc-sub">Importa tu catálogo de cuentas (Excel/CSV) con el detalle completo: código, nombre, clase, categoría, vencimientos y diferencia fiscal. Descarga la plantilla para ver el formato.</p>
                </div>
                <div className="acc-head-actions">
                    <button className="btn-secondary" onClick={() => downloadTemplate("xlsx")}><i className="ri-file-excel-2-line" /> Plantilla Excel</button>
                    <button className="btn-secondary" onClick={() => downloadTemplate("csv")}><i className="ri-file-text-line" /> Plantilla CSV</button>
                    {total > 0 && <button className="btn-secondary" onClick={() => exportCoa("xlsx")}><i className="ri-download-2-line" /> Exportar</button>}
                    <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
                        <i className="ri-upload-2-line" /> {importing ? "Importando..." : "Importar"}
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                </div>
            </div>

            {filtersMobileDrawer}

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : accounts.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay cuentas en el PUC. Descarga la plantilla, llénala con tus cuentas e impórtala.</p>
            ) : (
                <>
                    <PaginationToolbar
                        position="top"
                        page={page}
                        totalPages={totalPages}
                        totalItems={total}
                        pageSize={pageSize}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                        rangeStart={start}
                        rangeEnd={end}
                        isFetching={isPageFetching}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        showViewToggle
                        beforeViewToggle={filtersToolbar}
                    />
                    {renderView()}
                    <PaginationToolbar
                        position="bottom"
                        page={page}
                        totalPages={totalPages}
                        totalItems={total}
                        pageSize={pageSize}
                        rangeStart={start}
                        rangeEnd={end}
                        isFetching={isPageFetching}
                        onPageChange={handlePageChange}
                    />
                </>
            )}
        </div>
    );
};

export default Puc;
