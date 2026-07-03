import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../dian-sync/page/DianSync.css";
import "./Reconcile.css";
import {
    listSyncJobs,
    runReconcile,
    getSummary,
    listReconciliations,
    importFaltante,
    importBulk,
    type ReconItem,
    type ReconStatus,
    type ReconSummary,
} from "../reconcile.service";
import { openDocumentPdf } from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
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
import { useLedgerFiltersPanel } from "../../ledger/hooks/useLedgerFiltersPanel";
import {
    formatCOP,
    fmtDate,
    STATUS_META,
    PAGE_SIZE_OPTIONS,
    normalizePageSize,
    docLabel,
    syncJobLabel,
    type SyncJobOption,
} from "../reconcileUi";

const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "documento", label: "Documento", type: "text", icon: "ri-file-list-3-line" },
    { id: "emisor", label: "Emisor", type: "text", icon: "ri-building-line", serverSide: true },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "estado", label: "Estado", type: "select", icon: "ri-filter-3-line", serverSide: true, options: (Object.keys(STATUS_META) as ReconStatus[]).map((k) => ({ value: k, label: STATUS_META[k].label })) },
];

const ReconcilePage: React.FC = () => {
    const [jobs, setJobs] = useState<SyncJobOption[]>([]);
    const [selectedJob, setSelectedJob] = useState("");
    const [summary, setSummary] = useState<ReconSummary | null>(null);
    const [items, setItems] = useState<ReconItem[]>([]);
    const [statusFilter, setStatusFilter] = useState("");
    const [filterNit, setFilterNit] = useState("");
    const debouncedNit = useDebouncedValue(filterNit, FILTER_DEBOUNCE_MS);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);
    const [importingId, setImportingId] = useState("");
    const [grouped, setGrouped] = useState(false);
    const [allDianOnly, setAllDianOnly] = useState<ReconItem[]>([]);
    const [loadingAll, setLoadingAll] = useState(false);
    const [bulkNits, setBulkNits] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const { start, end } = paginationRange(page, pageSize, total);
    const getRowFilterValue = useCallback((row: ReconItem, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(row.fecha_emision);
            case "documento": return docLabel(row.prefijo, row.folio);
            case "emisor": return row.nombre_emisor || row.nit_emisor || "";
            case "total": return String(row.total ?? 0);
            case "estado": return row.status ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedItems = useMemo(() => filterRows(items), [items, filterRows]);
    const hasActiveFilters = statusFilter !== "" || filterNit.trim() !== "" || (jobs[0] && selectedJob !== jobs[0]._id) || hasActiveClientFilters;

    useEffect(() => {
        listSyncJobs()
            .then((r) => {
                setJobs(r.jobs);
                if (r.jobs[0]) setSelectedJob(r.jobs[0]._id);
            })
            .catch((e) => errorToast(e instanceof Error ? e.message : "Error al cargar las sincronizaciones"));
    }, []);

    const load = useCallback(async () => {
        if (!selectedJob) return;
        setLoading(true);
        try {
            const nit = debouncedNit.trim() || undefined;
            const [sum, list] = await Promise.all([
                getSummary(selectedJob),
                listReconciliations({
                    syncJobId: selectedJob,
                    status: statusFilter || undefined,
                    nit,
                    page,
                    pageSize,
                }),
            ]);
            setSummary(sum.summary);
            setItems(list.items);
            setTotal(list.total);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar la conciliación");
        } finally {
            setLoading(false);
        }
    }, [selectedJob, statusFilter, debouncedNit, page, pageSize]);

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        setPage(1);
    }, [statusFilter, debouncedNit, selectedJob, pageSize]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (page > pageCount) setPage(pageCount);
    }, [page, pageCount]);

    const handlePageChange = (nextPage: number) => setPage(Math.max(1, Math.min(pageCount, nextPage)));
    const handlePageSizeChange = (next: number) => {
        setPageSize(normalizePageSize(next));
        setPage(1);
    };

    const clearFilters = () => {
        setStatusFilter("");
        setFilterNit("");
        if (jobs[0]) setSelectedJob(jobs[0]._id);
        clearColFilters();
    };

    const handleRun = async () => {
        if (!selectedJob) return;
        setRunning(true);
        try {
            const r = await runReconcile(selectedJob);
            successToast(`Conciliación lista: ${r.matchOk} concuerdan, ${r.dianOnly} faltan en local, ${r.localOnly} faltan en la DIAN.`);
            setPage(1);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo conciliar");
        } finally {
            setRunning(false);
        }
    };

    const handleViewPdf = async (item: ReconItem) => {
        if (!item.dian_document_id) {
            errorToast("Esta factura no tiene PDF descargado.");
            return;
        }
        try {
            await openDocumentPdf(item.dian_document_id);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo abrir el PDF");
        }
    };

    const handleImport = async (item: ReconItem, kind: "purchase" | "expense") => {
        setImportingId(item._id);
        try {
            const r = await importFaltante(item._id, kind);
            successToast(r.message);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo importar la factura");
        } finally {
            setImportingId("");
        }
    };

    const loadAllDianOnly = useCallback(async () => {
        if (!selectedJob) return;
        setLoadingAll(true);
        try {
            const acc: ReconItem[] = [];
            let p = 1;
            let pages = 1;
            do {
                const res = await listReconciliations({ syncJobId: selectedJob, status: "dian_only", page: p, pageSize: 100 });
                acc.push(...res.items);
                pages = res.pageCount;
                p++;
            } while (p <= pages && p <= 50);
            setAllDianOnly(acc);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudieron cargar los documentos");
        } finally {
            setLoadingAll(false);
        }
    }, [selectedJob]);

    const toggleGrouped = async () => {
        const next = !grouped;
        setGrouped(next);
        if (next) await loadAllDianOnly();
    };

    const supplierGroups = useMemo(() => {
        const map = new Map<string, { nit: string; nombre: string; items: ReconItem[]; total: number }>();
        for (const it of allDianOnly) {
            const nit = it.nit_emisor || "—";
            const g = map.get(nit) ?? { nit, nombre: it.nombre_emisor || nit, items: [], total: 0 };
            g.items.push(it);
            g.total += it.total ?? 0;
            map.set(nit, g);
        }
        return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
    }, [allDianOnly]);

    const handleBulkBySupplier = async (nit: string, groupItems: ReconItem[], kind: "purchase" | "expense") => {
        setBulkNits((prev) => new Set(prev).add(nit));
        try {
            const r = await importBulk(
                groupItems.map((i) => i._id),
                kind,
            );
            successToast(r.message);
            const ids = new Set(groupItems.map((i) => i._id));
            setAllDianOnly((prev) => prev.filter((i) => !ids.has(i._id)));
            setSummary((s) =>
                s ? { ...s, dian_only: Math.max(0, s.dian_only - r.imported), match_ok: s.match_ok + r.imported } : s,
            );
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo importar el lote");
        } finally {
            setBulkNits((prev) => {
                const n = new Set(prev);
                n.delete(nit);
                return n;
            });
        }
    };

    const kpis = useMemo(
        () =>
            summary
                ? [
                      { key: "match_ok", label: "Concuerdan", value: summary.match_ok, cls: "dian-badge--ok" },
                      { key: "dian_only", label: "Faltan en local", value: summary.dian_only, cls: "dian-badge--info" },
                      { key: "mismatch", label: "A revisar", value: summary.mismatch, cls: "dian-badge--warning" },
                      { key: "local_only", label: "Faltan en la DIAN", value: summary.local_only, cls: "dian-badge--danger" },
                  ]
                : [],
        [summary],
    );

    const renderActions = (it: ReconItem, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            {it.dian_document_id && (
                <button type="button" className="btn-action" onClick={() => handleViewPdf(it)} title="Ver PDF">
                    <i className="ri-file-pdf-2-line" aria-hidden />
                    {layout === "table" ? " PDF" : null}
                </button>
            )}
            {it.status === "dian_only" && (
                <>
                    <button
                        type="button"
                        className="btn-action"
                        onClick={() => handleImport(it, "purchase")}
                        disabled={importingId === it._id}
                        title="Importar como compra"
                    >
                        {importingId === it._id ? <i className="ri-loader-4-line rotating" aria-hidden /> : <i className="ri-shopping-bag-3-line" aria-hidden />}
                        {layout === "table" ? " Compra" : null}
                    </button>
                    <button
                        type="button"
                        className="btn-action"
                        onClick={() => handleImport(it, "expense")}
                        disabled={importingId === it._id}
                        title="Importar como gasto"
                    >
                        <i className="ri-wallet-line" aria-hidden />
                        {layout === "table" ? " Gasto" : null}
                    </button>
                </>
            )}
            {it.status === "local_only" && <span className="dian-subtle">Revisar con el proveedor</span>}
        </div>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Documento</th>
                        <th>Emisor</th>
                        <th className="ds-num">Total</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedItems.map((it) => {
                        const meta = STATUS_META[it.status];
                        return (
                            <tr key={it._id}>
                                <td data-label="Fecha">{fmtDate(it.fecha_emision)}</td>
                                <td data-label="Documento">
                                    <strong>{docLabel(it.prefijo, it.folio)}</strong>
                                </td>
                                <td data-label="Emisor" title={it.cufe}>
                                    {it.nombre_emisor || it.nit_emisor || "—"}
                                </td>
                                <td data-label="Total" className="ds-num">
                                    {formatCOP(it.total)}
                                </td>
                                <td data-label="Estado">
                                    <span className={`dian-badge ${meta.cls}`}>{meta.label}</span>
                                </td>
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
                const meta = STATUS_META[it.status];
                return (
                    <article key={it._id} className="purchases-list-item">
                        <div className="purchases-list-item__body">
                            <div className="purchases-list-item__head">
                                <strong className="purchases-list-item__title">{docLabel(it.prefijo, it.folio)}</strong>
                                <span className="purchases-list-item__amount-badge">{formatCOP(it.total)}</span>
                            </div>
                            <div className="purchases-list-item__sub">
                                <strong>{it.nombre_emisor || it.nit_emisor || "—"}</strong>
                                <span>{fmtDate(it.fecha_emision)}</span>
                            </div>
                            <dl className="purchases-list-item__fields">
                                <div className="purchases-list-item__field">
                                    <dt>Estado</dt>
                                    <dd>
                                        <span className={`dian-badge ${meta.cls}`}>{meta.label}</span>
                                    </dd>
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
                const meta = STATUS_META[it.status];
                return (
                    <article key={it._id} className="purchases-card">
                        <div className="purchases-card__header">
                            <strong className="purchases-card__title">{docLabel(it.prefijo, it.folio)}</strong>
                            <span className="purchases-card__amount-badge">{formatCOP(it.total)}</span>
                        </div>
                        <div className="purchases-card__sub">
                            <strong>{it.nombre_emisor || it.nit_emisor || "—"}</strong>
                            <span>· {fmtDate(it.fecha_emision)}</span>
                        </div>
                        <dl className="purchases-card__fields">
                            <div className="purchases-card__field">
                                <dt>Estado</dt>
                                <dd>
                                    <span className={`dian-badge ${meta.cls}`}>{meta.label}</span>
                                </dd>
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

    const { filtersToolbar, filtersMobileDrawer } = useLedgerFiltersPanel({
        panelId: "recon-purchases",
        title: "Filtrar conciliación",
        hasActiveFilters: !!hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [statusFilter, filterNit, selectedJob, colFilterValues],
        filterContent: (
            <>
                <FilterField label="Sincronización" htmlFor="recon-purch-sync" icon="ri-refresh-line">
                    <FieldControl id="recon-purch-sync" as="select" value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)}>
                        {jobs.length === 0 && <option value="">No hay sincronizaciones</option>}
                        {jobs.map((j) => (
                            <option key={j._id} value={j._id}>
                                {syncJobLabel(j)}
                            </option>
                        ))}
                    </FieldControl>
                </FilterField>
                <FilterField label="Estado" htmlFor="recon-purch-status" icon="ri-filter-3-line">
                    <FieldControl
                        id="recon-purch-status"
                        as="select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Todos</option>
                        {(Object.keys(STATUS_META) as ReconStatus[]).map((k) => (
                            <option key={k} value={k}>
                                {STATUS_META[k].label}
                            </option>
                        ))}
                    </FieldControl>
                </FilterField>
                <FilterField label="NIT emisor" htmlFor="recon-purch-nit" icon="ri-building-line">
                    <FieldControl
                        id="recon-purch-nit"
                        type="text"
                        value={filterNit}
                        onChange={(e) => setFilterNit(e.target.value)}
                        placeholder="Filtrar por NIT del proveedor"
                    />
                </FilterField>
                <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
            </>
        ),
    });

    return (
        <ListPageShell className="dian-page purchases-page">
            <ListPageContainer className="dian-container purchases-container">
                <ListPageHeader
                    className="dian-header purchases-header"
                    title="Conciliación DIAN — recibidas (compras)"
                    subtitle="Compara tus compras registradas con las que la DIAN tiene de esta empresa. Importa las que falten y revisa las que no cuadran."
                />

                <section className="recon-section">
                    <div className="recon-section__toolbar">
                        <FilterField label="Sincronización" htmlFor="recon-purch-sync-inline" icon="ri-refresh-line">
                            <FieldControl
                                id="recon-purch-sync-inline"
                                as="select"
                                value={selectedJob}
                                onChange={(e) => {
                                    setSelectedJob(e.target.value);
                                    setPage(1);
                                }}
                            >
                                {jobs.length === 0 && <option value="">No hay sincronizaciones</option>}
                                {jobs.map((j) => (
                                    <option key={j._id} value={j._id}>
                                        {syncJobLabel(j)}
                                    </option>
                                ))}
                            </FieldControl>
                        </FilterField>
                        <button type="button" className="btn-primary" onClick={handleRun} disabled={!selectedJob || running}>
                            {running ? (
                                <>
                                    <i className="ri-loader-4-line rotating" aria-hidden /> Conciliando…
                                </>
                            ) : (
                                <>
                                    <i className="ri-scales-3-line" aria-hidden /> Conciliar
                                </>
                            )}
                        </button>
                    </div>

                    {summary && (
                        <div className="recon-kpis">
                            {kpis.map((k) => (
                                <button
                                    key={k.key}
                                    type="button"
                                    className={`recon-kpi ${statusFilter === k.key ? "is-active" : ""}`}
                                    onClick={() => {
                                        setStatusFilter(statusFilter === k.key ? "" : k.key);
                                        setPage(1);
                                    }}
                                >
                                    <span className={`dian-badge ${k.cls}`}>{k.value}</span>
                                    <span className="recon-kpi__label">{k.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <section className="recon-section">
                    <div className="recon-section__head">
                        <p className="pm-hint" style={{ margin: 0 }}>
                            Documentos
                            {statusFilter && (
                                <span className="dian-subtle"> · {STATUS_META[statusFilter as ReconStatus]?.label}</span>
                            )}
                        </p>
                        <div className="recon-section__head-actions">
                            <button
                                type="button"
                                className={`btn-secondary ${grouped ? "is-active" : ""}`}
                                onClick={toggleGrouped}
                                title="Agrupar las que faltan en local por proveedor"
                            >
                                <i className="ri-group-line" aria-hidden /> {grouped ? "Ver lista" : "Agrupar por proveedor"}
                            </button>
                        </div>
                    </div>

                    {filtersMobileDrawer}

                    {grouped ? (
                        loadingAll ? (
                            <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                                Cargando proveedores…
                            </div>
                        ) : supplierGroups.length === 0 ? (
                            <div className="purchases-empty">
                                <i className="ri-group-line" />
                                <p>No hay facturas faltantes para agrupar. Pulsa Conciliar primero.</p>
                            </div>
                        ) : (
                            <div className="recon-groups">
                                {supplierGroups.map((g) => (
                                    <div key={g.nit} className="recon-group">
                                        <div className="recon-group__head">
                                            <div>
                                                <strong>{g.nombre}</strong> <span className="dian-subtle">NIT {g.nit}</span>
                                                <div className="dian-subtle">
                                                    {g.items.length} factura(s) · {formatCOP(g.total)}
                                                </div>
                                            </div>
                                            <div className="recon-group__actions">
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => handleBulkBySupplier(g.nit, g.items, "purchase")}
                                                    disabled={bulkNits.has(g.nit)}
                                                >
                                                    {bulkNits.has(g.nit) ? (
                                                        <i className="ri-loader-4-line rotating" aria-hidden />
                                                    ) : (
                                                        <i className="ri-shopping-bag-3-line" aria-hidden />
                                                    )}{" "}
                                                    Todas a Compras
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-secondary"
                                                    onClick={() => handleBulkBySupplier(g.nit, g.items, "expense")}
                                                    disabled={bulkNits.has(g.nit)}
                                                >
                                                    <i className="ri-wallet-line" aria-hidden /> Todas a Gastos
                                                </button>
                                            </div>
                                        </div>
                                        <div className="recon-group__docs">
                                            {g.items.slice(0, 8).map((it) => (
                                                <button
                                                    key={it._id}
                                                    type="button"
                                                    className="recon-chip recon-chip--pdf"
                                                    onClick={() => handleViewPdf(it)}
                                                    title="Ver PDF"
                                                >
                                                    <i className="ri-file-pdf-2-line" aria-hidden /> {docLabel(it.prefijo, it.folio)} ·{" "}
                                                    {formatCOP(it.total)}
                                                </button>
                                            ))}
                                            {g.items.length > 8 && <span className="recon-chip">+{g.items.length - 8} más</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <>
                            {!loading && items.length > 0 && (
                                <PaginationToolbar
                                    position="top"
                                    page={page}
                                    totalPages={pageCount}
                                    totalItems={total}
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
                                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                                    Cargando…
                                </div>
                            ) : items.length === 0 ? (
                                <div className="purchases-empty">
                                    <i className="ri-scales-3-line" />
                                    <p>No hay documentos. Pulsa Conciliar para comparar esta sincronización con tus compras.</p>
                                </div>
                            ) : (
                                <>
                                    {renderView()}
                                    <PaginationToolbar
                                        position="bottom"
                                        page={page}
                                        totalPages={pageCount}
                                        totalItems={total}
                                        pageSize={pageSize}
                                        rangeStart={start}
                                        rangeEnd={end}
                                        isFetching={loading}
                                        onPageChange={handlePageChange}
                                    />
                                </>
                            )}
                        </>
                    )}
                </section>
            </ListPageContainer>
        </ListPageShell>
    );
};

export default ReconcilePage;
