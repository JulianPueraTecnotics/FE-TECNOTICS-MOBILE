import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import {
    genericPreview,
    genericImport,
    genericPost,
    getStatementProfiles,
    saveStatementProfile,
    deleteStatementProfile,
    type StatementPreview,
    type StatementProfile,
    type BankStatementPdfResult,
} from "../reconciliation.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    PaginationToolbar,
    paginationRange,
    FilterField,
    FiltersMobileDrawer,
    FieldControl,
    useConfirm,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const money = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const fdate = (d: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "descripcion", label: "Descripción", type: "text", icon: "ri-file-text-line", serverSide: true },
    { id: "referencia", label: "Referencia", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "valor", label: "Valor", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "cruce", label: "Cruce", type: "text", icon: "ri-user-search-line", serverSide: true },
];

const emptyProfile: StatementProfile = {
    nombre: "",
    header_row: 0,
    col_fecha: 0,
    col_descripcion: 1,
    col_valor: 2,
    col_debito: null,
    col_credito: null,
    col_referencia: null,
    formato_fecha: "dmy",
    decimal: ",",
    debito_negativo: true,
};

type Step = "subir" | "mapear" | "revisar";
type ValorModo = "una" | "dos";

type MovRow = BankStatementPdfResult["movimientos"][number];

const ImportExtracto: React.FC = () => {
    const { confirm } = useConfirm();
    const fileRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [step, setStep] = useState<Step>("subir");
    const [preview, setPreview] = useState<StatementPreview | null>(null);
    const [profile, setProfile] = useState<StatementProfile>(emptyProfile);
    const [valorModo, setValorModo] = useState<ValorModo>("una");
    const [saved, setSaved] = useState<StatementProfile[]>([]);
    const [result, setResult] = useState<BankStatementPdfResult | null>(null);
    const [loading, setLoading] = useState(false);

    const [filterSearch, setFilterSearch] = useState("");
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});
    const getRowFilterValue = useCallback((row: MovRow, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(row.fecha);
            case "descripcion": return row.descripcion ?? "";
            case "referencia": return row.referencia1 ?? "";
            case "valor": return String(row.valor ?? 0);
            case "cruce":
                if (row.cliente_match?.nombre) return row.cliente_match.nombre;
                if (row.coincidencias_valor?.length) return String(row.coincidencias_valor.length);
                return "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || hasActiveClientFilters;

    useEffect(() => { getStatementProfiles().then(setSaved).catch(() => setSaved([])); }, []);

    const onPickFile = async (f: File | null) => {
        if (!f) return;
        setFile(f);
        setResult(null);
        setStep("subir");
        setFilterSearch("");
        setPage(1);
        setLoading(true);
        try {
            const prev = await genericPreview(f);
            setPreview(prev);
            setStep("mapear");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo leer el archivo");
        } finally {
            setLoading(false);
        }
    };

    const applyProfile = (p: StatementProfile) => {
        setProfile(p);
        setValorModo(p.col_valor != null && p.col_valor >= 0 ? "una" : "dos");
    };

    const colOptions = preview ? Array.from({ length: preview.columnas }, (_, i) => i) : [];
    const headerRow = preview?.filas[profile.header_row] ?? [];
    const colLabel = (i: number) => {
        const h = String(headerRow[i] ?? "").trim();
        return h ? `Col ${i + 1}: ${h.slice(0, 22)}` : `Columna ${i + 1}`;
    };

    const buildProfile = (): StatementProfile => ({
        ...profile,
        col_valor: valorModo === "una" ? Number(profile.col_valor) : null,
        col_debito: valorModo === "dos" ? Number(profile.col_debito) : null,
        col_credito: valorModo === "dos" ? Number(profile.col_credito) : null,
    });

    const validMap = () => {
        if (profile.col_fecha == null || profile.col_descripcion == null) return false;
        if (valorModo === "una") return profile.col_valor != null && profile.col_valor >= 0;
        return profile.col_debito != null && profile.col_credito != null;
    };

    const doImport = async () => {
        if (!file || !validMap()) { errorToast("Mapea al menos fecha, descripción y el valor (o débito/crédito)"); return; }
        setLoading(true);
        try {
            const res = await genericImport(file, buildProfile());
            setResult(res);
            setStep("revisar");
            setPage(1);
            setFilterSearch("");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al importar");
        } finally {
            setLoading(false);
        }
    };

    const doPost = async () => {
        if (!file) return;
        if (!(await confirm("¿Registrar estos movimientos en el libro banco? (no duplica los ya registrados)"))) return;
        setLoading(true);
        try {
            const r = await genericPost(file, buildProfile());
            successToast(r.message);
            setFile(null); setPreview(null); setResult(null); setStep("subir");
            if (fileRef.current) fileRef.current.value = "";
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al registrar");
        } finally {
            setLoading(false);
        }
    };

    const doSaveProfile = async () => {
        const p = buildProfile();
        if (!p.nombre.trim()) { errorToast("Ponle un nombre al perfil (ej. 'Davivienda ahorros')"); return; }
        if (!validMap()) { errorToast("Completa el mapeo antes de guardar el perfil"); return; }
        try {
            await saveStatementProfile(p);
            successToast("Perfil guardado");
            setSaved(await getStatementProfiles());
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const doDeleteProfile = async (id?: string) => {
        if (!id || !(await confirm("¿Eliminar este perfil de mapeo?"))) return;
        try {
            await deleteStatementProfile(id);
            setSaved(await getStatementProfiles());
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const movimientos = result?.movimientos ?? [];
    const filteredMovs = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        const base = !q
            ? movimientos
            : movimientos.filter((m) =>
                m.descripcion.toLowerCase().includes(q) ||
                (m.referencia1 ?? "").toLowerCase().includes(q) ||
                (m.cliente_match?.nombre ?? "").toLowerCase().includes(q),
            );
        return filterRows(base);
    }, [movimientos, debouncedSearch, filterRows]);

    const totalItems = filteredMovs.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedMovs = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredMovs.slice(start, start + pageSize);
    }, [filteredMovs, safePage, pageSize]);
    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    useEffect(() => { setPage(1); }, [debouncedSearch, pageSize, result]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const clearFilters = () => { setFilterSearch(""); clearColFilters(); };

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
        return () => { window.removeEventListener("resize", onReflow); window.removeEventListener("scroll", onReflow, true); };
    }, [filtersOpen, isMobile, updateFiltersPanelPosition]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onPointer = (e: MouseEvent) => {
            const target = e.target as Node;
            if (filtersDropdownRef.current?.contains(target) || filtersPanelRef.current?.contains(target)) return;
            setFiltersOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFiltersOpen(false); };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
    }, [filtersOpen, isMobile]);

    const renderCruce = (m: MovRow) => {
        if (m.cliente_match) return <span className="status-badge status-paid">{m.cliente_match.nombre}</span>;
        if (m.coincidencias_valor?.length) return <span className="status-badge status-pending">{m.coincidencias_valor.length} posible(s)</span>;
        return "—";
    };

    const renderMovTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Referencia</th>
                        <th className="num-col">Valor</th>
                        <th>Cruce</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedMovs.map((m, i) => (
                        <tr key={`${m.fecha}-${i}`}>
                            <td data-label="Fecha">{fdate(m.fecha)}</td>
                            <td data-label="Descripción">{m.descripcion}</td>
                            <td data-label="Referencia">{m.referencia1 || "—"}</td>
                            <td data-label="Valor" className="num-col" style={{ fontWeight: 600, color: m.valor >= 0 ? "var(--accent-teal)" : "var(--tertiary-color)" }}>{money(m.valor)}</td>
                            <td data-label="Cruce">{renderCruce(m)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderMovList = () => (
        <div className="purchases-list-view">
            {paginatedMovs.map((m, i) => (
                <article key={`${m.fecha}-${i}`} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{m.descripcion.slice(0, 48)}</strong>
                            <span className="purchases-list-item__amount-badge">{money(m.valor)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{fdate(m.fecha)}</strong>
                            <span>{m.referencia1 || "Sin referencia"}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field"><dt>Cruce</dt><dd>{m.cliente_match?.nombre ?? (m.coincidencias_valor?.length ? `${m.coincidencias_valor.length} posible(s)` : "—")}</dd></div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderMovCards = () => (
        <div className="purchases-cards-view">
            {paginatedMovs.map((m, i) => (
                <article key={`${m.fecha}-${i}`} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{money(m.valor)}</strong>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{fdate(m.fecha)}</strong>
                        <span>· {m.referencia1 || "—"}</span>
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>{m.descripcion}</p>
                </article>
            ))}
        </div>
    );

    const renderMovView = () => {
        if (effectiveViewMode === "list") return renderMovList();
        if (effectiveViewMode === "cards") return renderMovCards();
        return renderMovTable();
    };

    const filterContent = (
        <>
            <FilterField label="Búsqueda" htmlFor="extracto-filter-search" icon="ri-search-line">
                <FieldControl id="extracto-filter-search" type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Descripción, referencia o cliente" />
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="extracto-filters-heading" className="purchases-filters-panel__title">Filtrar movimientos</h2>
                {hasActiveFilters && <button type="button" className="purchases-filters-clear" onClick={clearFilters}>Limpiar</button>}
            </div>
            <div className="purchases-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="purchases-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="purchases-filters-clear purchases-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden /> Limpiar
                </button>
            )}
            <div className="purchases-filters-dropdown" ref={filtersDropdownRef}>
                <button ref={filtersToggleRef} type="button" className={`purchases-filters-toggle ${filtersOpen ? "open" : ""}`} onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} aria-haspopup="true" aria-controls="extracto-filters-panel">
                    <i className="ri-filter-3-line" aria-hidden /> Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen && !isMobile && typeof document !== "undefined" && createPortal(
                    <div ref={filtersPanelRef} id="extracto-filters-panel" className="purchases-filters-panel purchases-filters-panel--floating" style={filtersPanelStyle} role="region" aria-labelledby="extracto-filters-heading">
                        {filtersPanelContent}
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <div className="purchases-sticky-head">
                    <ListPageHeader
                        className="purchases-header"
                        title="Importar extracto"
                        subtitle="Sube el extracto en Excel o CSV de cualquier banco, mapea las columnas y registra los movimientos. El mapeo se guarda como perfil reutilizable."
                        actions={
                            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={loading}>
                                <i className="ri-upload-2-line" aria-hidden /> {file ? "Cambiar archivo" : "Elegir archivo"}
                            </button>
                        }
                    />
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
                </div>

                {file && (
                    <p className="pm-hint" style={{ marginBottom: 12 }}>Archivo: <strong>{file.name}</strong></p>
                )}

                {saved.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                        <p className="pm-hint">Perfiles guardados:</p>
                        <div className="purchases-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                            {saved.map((p) => (
                                <span key={p._id} className="status-badge status-pending" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                    <button type="button" className="btn-link" style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }} onClick={() => applyProfile(p)}>{p.nombre}</button>
                                    <i className="ri-close-line" style={{ cursor: "pointer" }} onClick={() => doDeleteProfile(p._id)} role="button" tabIndex={0} aria-label={`Eliminar perfil ${p.nombre}`} />
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {preview && step !== "subir" && (
                    <section style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: "1.05rem", margin: "0 0 8px" }}>2. Mapear columnas</h2>
                        <p className="pm-hint">{preview.total_filas} fila(s), {preview.columnas} columna(s).</p>

                        <div className="purchases-table-container ds-table-container" style={{ marginTop: 12, maxHeight: 280, overflow: "auto" }}>
                            <table className="purchases-table ds-table">
                                <thead>
                                    <tr><th>#</th>{colOptions.map((i) => <th key={i}>{`Col ${i + 1}`}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {preview.filas.map((row, ri) => (
                                        <tr key={ri} style={ri === profile.header_row ? { fontWeight: 700, background: "rgba(96,153,172,0.12)" } : undefined}>
                                            <td>{ri + 1}{ri === profile.header_row ? " (encab.)" : ""}</td>
                                            {colOptions.map((ci) => <td key={ci}>{String(row[ci] ?? "")}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="purchases-filters-grid" style={{ marginTop: 16 }}>
                            <FilterField label="Fila de encabezado" htmlFor="map-header" icon="ri-layout-row-line">
                                <FieldControl as="select" id="map-header" value={String(profile.header_row)} onChange={(e) => setProfile((p) => ({ ...p, header_row: Number(e.target.value) }))}>
                                    {preview.filas.map((_, i) => <option key={i} value={i}>Fila {i + 1}</option>)}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Columna Fecha *" htmlFor="map-fecha" icon="ri-calendar-line">
                                <FieldControl as="select" id="map-fecha" value={String(profile.col_fecha)} onChange={(e) => setProfile((p) => ({ ...p, col_fecha: Number(e.target.value) }))}>
                                    {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Columna Descripción *" htmlFor="map-desc" icon="ri-file-text-line">
                                <FieldControl as="select" id="map-desc" value={String(profile.col_descripcion)} onChange={(e) => setProfile((p) => ({ ...p, col_descripcion: Number(e.target.value) }))}>
                                    {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Formato del valor" htmlFor="map-valor-modo" icon="ri-exchange-funds-line">
                                <FieldControl as="select" id="map-valor-modo" value={valorModo} onChange={(e) => setValorModo(e.target.value as ValorModo)}>
                                    <option value="una">Una columna con signo (+/−)</option>
                                    <option value="dos">Dos columnas: débito y crédito</option>
                                </FieldControl>
                            </FilterField>
                            {valorModo === "una" ? (
                                <FilterField label="Columna Valor *" htmlFor="map-valor" icon="ri-money-dollar-circle-line">
                                    <FieldControl as="select" id="map-valor" value={String(profile.col_valor ?? 0)} onChange={(e) => setProfile((p) => ({ ...p, col_valor: Number(e.target.value) }))}>
                                        {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                                    </FieldControl>
                                </FilterField>
                            ) : (
                                <>
                                    <FilterField label="Columna Débito *" htmlFor="map-debito" icon="ri-arrow-down-line">
                                        <FieldControl as="select" id="map-debito" value={String(profile.col_debito ?? 0)} onChange={(e) => setProfile((p) => ({ ...p, col_debito: Number(e.target.value) }))}>
                                            {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                                        </FieldControl>
                                    </FilterField>
                                    <FilterField label="Columna Crédito *" htmlFor="map-credito" icon="ri-arrow-up-line">
                                        <FieldControl as="select" id="map-credito" value={String(profile.col_credito ?? 0)} onChange={(e) => setProfile((p) => ({ ...p, col_credito: Number(e.target.value) }))}>
                                            {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                                        </FieldControl>
                                    </FilterField>
                                </>
                            )}
                            <FilterField label="Referencia (opcional)" htmlFor="map-ref" icon="ri-hashtag">
                                <FieldControl as="select" id="map-ref" value={String(profile.col_referencia ?? -1)} onChange={(e) => setProfile((p) => ({ ...p, col_referencia: Number(e.target.value) < 0 ? null : Number(e.target.value) }))}>
                                    <option value={-1}>— Ninguna —</option>
                                    {colOptions.map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Formato de fecha" htmlFor="map-fmt-fecha" icon="ri-calendar-2-line">
                                <FieldControl as="select" id="map-fmt-fecha" value={profile.formato_fecha} onChange={(e) => setProfile((p) => ({ ...p, formato_fecha: e.target.value as StatementProfile["formato_fecha"] }))}>
                                    <option value="dmy">Día/Mes/Año</option>
                                    <option value="mdy">Mes/Día/Año</option>
                                    <option value="ymd">Año/Mes/Día</option>
                                    <option value="iso">ISO (2026-12-31)</option>
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Separador decimal" htmlFor="map-decimal" icon="ri-more-line">
                                <FieldControl as="select" id="map-decimal" value={profile.decimal} onChange={(e) => setProfile((p) => ({ ...p, decimal: e.target.value as "," | "." }))}>
                                    <option value=",">Coma (Colombia)</option>
                                    <option value=".">Punto</option>
                                </FieldControl>
                            </FilterField>
                            <FilterField label="Nombre del perfil" htmlFor="map-nombre" icon="ri-bookmark-line">
                                <FieldControl id="map-nombre" type="text" value={profile.nombre} onChange={(e) => setProfile((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Davivienda ahorros" />
                            </FilterField>
                        </div>

                        <div className="purchases-actions" style={{ marginTop: 16, flexWrap: "wrap" }}>
                            <button type="button" className="btn-secondary" onClick={doSaveProfile} disabled={loading}><i className="ri-save-line" aria-hidden /> Guardar perfil</button>
                            <button type="button" className="btn-primary" onClick={doImport} disabled={loading || !validMap()}>{loading ? "Procesando…" : "Previsualizar movimientos"}</button>
                        </div>
                    </section>
                )}

                {result && step === "revisar" && (
                    <section>
                        <div className="purchases-header" style={{ padding: 0, border: "none", boxShadow: "none", marginBottom: 12 }}>
                            <div className="header-content">
                                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>3. Revisar y registrar</h2>
                                <p className="pm-hint" style={{ margin: "4px 0 0" }}>
                                    {movimientos.length} movimiento(s) · Abonos {money(result.total_abonos)} · Cargos {money(result.total_cargos)}
                                    {result.pagos_cliente ? ` · ${result.pagos_cliente} pago(s) de cliente` : ""}
                                </p>
                            </div>
                            <button type="button" className="btn-primary" onClick={doPost} disabled={loading || !movimientos.length}>
                                <i className="ri-bank-line" aria-hidden /> {loading ? "Registrando…" : "Registrar en el banco"}
                            </button>
                        </div>

                        <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar movimientos"
    ariaLabelledBy="extracto-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                        {movimientos.length === 0 ? (
                            <div className="purchases-empty"><i className="ri-file-warning-line" /><p>No se reconocieron movimientos. Revisa el mapeo de columnas.</p></div>
                        ) : (
                            <>
                                <PaginationToolbar
                                    position="top"
                                    page={safePage}
                                    totalPages={totalPages}
                                    totalItems={totalItems}
                                    pageSize={pageSize}
                                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                                    rangeStart={start}
                                    rangeEnd={end}
                                    onPageChange={(p) => setPage(Math.max(1, Math.min(totalPages, p)))}
                                    onPageSizeChange={(s) => { setPageSize(normalizePageSize(s)); setPage(1); }}
                                    viewMode={viewMode}
                                    onViewModeChange={setViewMode}
                                    showViewToggle
                                    beforeViewToggle={filtersToolbar}
                                />
                                {totalItems === 0 ? (
                                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 24 }}>Sin movimientos que coincidan con los filtros</div>
                                ) : (
                                    <>
                                        {renderMovView()}
                                        <PaginationToolbar position="bottom" page={safePage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} rangeStart={start} rangeEnd={end} onPageChange={(p) => setPage(Math.max(1, Math.min(totalPages, p)))} />
                                    </>
                                )}
                                {movimientos.length > 200 && debouncedSearch.trim() === "" && (
                                    <p className="pm-hint" style={{ marginTop: 8 }}>Mostrando todos los {movimientos.length} movimientos con paginación.</p>
                                )}
                            </>
                        )}
                    </section>
                )}
            </ListPageContainer>
        </ListPageShell>
    );
};

export default ImportExtracto;
