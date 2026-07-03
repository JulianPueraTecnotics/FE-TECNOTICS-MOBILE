import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../../purchases/page/Purchases.css";
import { getEntries, postEntry, annulEntry } from "../ledger.service";
import { JOURNAL_TYPE_LABELS, JOURNAL_STATUS_LABELS, type JournalEntry, type JournalType } from "../ledger.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import EntryEditor from "./EntryEditor";
import EntryDetail from "./EntryDetail";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    PaginationToolbar,
    paginationRange,
    FilterField,
    FieldControl,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    useEffectiveViewMode,
    useConfirm,
    type ViewMode,
} from "../../../components/design-system";
import { formatDate, formatMoney, normalizePageSize, PAGE_SIZE_OPTIONS } from "../ledgerFormat";
import { useLedgerFiltersPanel } from "../hooks/useLedgerFiltersPanel";

const STATUS_CLS: Record<string, string> = { borrador: "status-pending", contabilizado: "status-paid", anulado: "status-rejected" };
const TYPE_FILTER: JournalType[] = ["NC", "CC", "CE", "RC", "FV", "DEP", "NOM", "EXT"];
const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};
const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "valor", label: "Valor", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "descripcion", label: "Descripción", type: "text", icon: "ri-file-text-line", serverSide: true },
];

const JournalEntries: React.FC = () => {
    const { confirm } = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();
    const viewingEntryId = searchParams.get("entry");
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [tipo, setTipo] = useState("");
    const [estado, setEstado] = useState("");
    const [filterSearch, setFilterSearch] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null | undefined>(undefined);

    const openEntryDetail = (id: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("sec", "comprobantes");
            next.set("entry", id);
            return next;
        });
    };

    const closeEntryDetail = () => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("entry");
            next.set("sec", "comprobantes");
            return next;
        });
    };

    const getRowFilterValue = useCallback((row: JournalEntry, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(row.fecha);
            case "valor": return String(row.total_debito ?? 0);
            case "descripcion": return row.descripcion ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedEntries = filterRows(entries);
    const hasActiveFilters = tipo !== "" || estado !== "" || filterSearch.trim() !== "" || hasActiveClientFilters;

    useRealtime(RealtimeEvents.JOURNAL_CHANGED, (payload) => setEntries((prev) => applyRealtimeChange(prev, payload)));

    const load = useCallback(async () => {
        const hasData = entries.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        try {
            const res = await getEntries({ tipo, estado, search: debouncedSearch.trim() || undefined, page, limit: pageSize });
            setEntries(res.entries);
            setTotalPages(res.pagination.totalPages || 1);
            setTotalItems(res.pagination.total ?? 0);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar comprobantes");
        } finally {
            setLoading(false);
            setIsPageFetching(false);
        }
    }, [tipo, estado, debouncedSearch, page, pageSize, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        if (page !== 1) setPage(1);
    }, [tipo, estado, debouncedSearch, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (editing === undefined && !viewingEntryId) load();
    }, [load, editing, viewingEntryId]);

    const handlePageChange = (nextPage: number) => setPage(Math.max(1, Math.min(totalPages, nextPage)));
    const handlePageSizeChange = (next: number) => {
        setPageSize(normalizePageSize(next));
        setPage(1);
    };

    const { start, end } = paginationRange(page, pageSize, totalItems);

    const clearFilters = () => {
        setTipo("");
        setEstado("");
        setFilterSearch("");
        clearColFilters();
    };

    const { filtersToolbar, filtersMobileDrawer } = useLedgerFiltersPanel({
        panelId: "led-comprobantes",
        title: "Filtrar comprobantes",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [filterSearch, tipo, estado],
        filterContent: (
            <>
                <FilterField label="Búsqueda" htmlFor="led-je-search" icon="ri-search-line">
                    <FieldControl
                        id="led-je-search"
                        type="text"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder="Descripción o consecutivo"
                    />
                </FilterField>
                <FilterField label="Tipo" htmlFor="led-je-tipo" icon="ri-file-list-3-line">
                    <FieldControl id="led-je-tipo" as="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                        <option value="">Todos los tipos</option>
                        {TYPE_FILTER.map((t) => (
                            <option key={t} value={t}>
                                {JOURNAL_TYPE_LABELS[t]}
                            </option>
                        ))}
                    </FieldControl>
                </FilterField>
                <FilterField label="Estado" htmlFor="led-je-estado" icon="ri-checkbox-circle-line">
                    <FieldControl id="led-je-estado" as="select" value={estado} onChange={(e) => setEstado(e.target.value)}>
                        <option value="">Todos los estados</option>
                        <option value="borrador">Borrador</option>
                        <option value="contabilizado">Contabilizado</option>
                        <option value="anulado">Anulado</option>
                    </FieldControl>
                </FilterField>
                <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="led-je-col" />
            </>
        ),
    });

    const onPost = async (e: JournalEntry) => {
        setBusyId(e._id);
        try {
            await postEntry(e._id);
            successToast("Comprobante contabilizado");
            setRefreshKey((k) => k + 1);
        } catch (err) {
            errorToast(err instanceof Error ? err.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    const onAnnul = async (e: JournalEntry) => {
        if (!(await confirm(`¿Anular el comprobante ${e.tipo}-${e.consecutivo}? Si está contabilizado se generará un reverso.`))) return;
        setBusyId(e._id);
        try {
            const res = await annulEntry(e._id);
            successToast(res.message || "Comprobante anulado");
            setRefreshKey((k) => k + 1);
        } catch (err) {
            errorToast(err instanceof Error ? err.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    const openDetail = (e: JournalEntry) => {
        if (e.estado === "borrador") {
            setEditing(e._id);
            return;
        }
        openEntryDetail(e._id);
    };

    const renderStatus = (e: JournalEntry) => (
        <span
            className={`status-badge ${STATUS_CLS[e.estado] ?? ""}${e.estado !== "borrador" ? " status-badge--clickable" : ""}`}
            onClick={e.estado !== "borrador" ? () => openEntryDetail(e._id) : undefined}
            onKeyDown={
                e.estado !== "borrador"
                    ? (ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                              ev.preventDefault();
                              openEntryDetail(e._id);
                          }
                      }
                    : undefined
            }
            role={e.estado !== "borrador" ? "button" : undefined}
            tabIndex={e.estado !== "borrador" ? 0 : undefined}
            title={e.estado !== "borrador" ? "Ver detalle del comprobante" : undefined}
        >
            {JOURNAL_STATUS_LABELS[e.estado]}
        </span>
    );

    const renderComprobante = (e: JournalEntry) => (
        <button type="button" className="led-comprobante-link" onClick={() => openDetail(e)} title="Ver detalle">
            {e.tipo}-{e.consecutivo}
        </button>
    );
    const renderActions = (e: JournalEntry, layout: "table" | "list" | "cards" = "table") => {
        const busy = busyId === e._id;
        const compact = layout !== "table";
        return (
            <div className="led-row-actions ds-row-actions">
                {e.estado !== "borrador" && (
                    <button type="button" className="btn-action" onClick={() => openEntryDetail(e._id)} disabled={busy}>
                        <i className="ri-eye-line" aria-hidden />
                        {!compact && " Ver"}
                    </button>
                )}
                {e.estado === "borrador" && (
                    <>
                        <button type="button" className="btn-action" onClick={() => setEditing(e._id)} disabled={busy}>
                            <i className="ri-edit-line" aria-hidden />
                            {!compact && " Editar"}
                        </button>
                        <button type="button" className="btn-action" onClick={() => onPost(e)} disabled={busy}>
                            <i className="ri-checkbox-circle-line" aria-hidden />
                            {!compact && (busy ? " Contabilizando…" : " Contabilizar")}
                        </button>
                    </>
                )}
                {e.estado !== "anulado" && (
                    <button type="button" className="btn-action" onClick={() => onAnnul(e)} disabled={busy}>
                        <i className="ri-close-circle-line" aria-hidden />
                        {!compact && " Anular"}
                    </button>
                )}
            </div>
        );
    };

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Comprobante</th>
                        <th>Tipo</th>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th className="ds-num">Valor</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedEntries.map((e) => (
                        <tr key={e._id}>
                            <td data-label="Comprobante">{renderComprobante(e)}</td>
                            <td data-label="Tipo">{JOURNAL_TYPE_LABELS[e.tipo]}</td>
                            <td data-label="Fecha">{formatDate(e.fecha)}</td>
                            <td data-label="Descripción">{e.descripcion || "—"}</td>
                            <td data-label="Valor" className="ds-num">
                                <strong>{formatMoney(e.total_debito)}</strong>
                            </td>
                            <td data-label="Estado">{renderStatus(e)}</td>
                            <td data-label="Acciones">{renderActions(e)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {displayedEntries.map((e) => (
                <article key={e._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <div className="purchases-list-item__title">{renderComprobante(e)}</div>
                            <span className="purchases-list-item__amount-badge">{formatMoney(e.total_debito)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{JOURNAL_TYPE_LABELS[e.tipo]}</strong>
                            <span>{formatDate(e.fecha)}</span>
                            {renderStatus(e)}
                        </div>
                        {e.descripcion && (
                            <p className="pm-hint" style={{ margin: "0.35rem 0 0" }}>
                                {e.descripcion}
                            </p>
                        )}
                        <div style={{ marginTop: "0.65rem" }}>{renderActions(e, "list")}</div>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {displayedEntries.map((e) => (
                <article key={e._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <div className="purchases-card__title">{renderComprobante(e)}</div>
                        <span className="purchases-card__amount-badge">{formatMoney(e.total_debito)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{JOURNAL_TYPE_LABELS[e.tipo]}</strong>
                        <span>· {formatDate(e.fecha)}</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field purchases-card__field--full">
                            <dt>Descripción</dt>
                            <dd>{e.descripcion || "—"}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Estado</dt>
                            <dd>{renderStatus(e)}</dd>
                        </div>
                    </dl>
                    <div className="purchases-card__actions">{renderActions(e, "cards")}</div>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    if (viewingEntryId) {
        return <EntryDetail entryId={viewingEntryId} onClose={closeEntryDetail} />;
    }

    if (editing !== undefined) {
        return (
            <EntryEditor
                entryId={editing || null}
                onClose={() => setEditing(undefined)}
                onSaved={() => {
                    setEditing(undefined);
                    setRefreshKey((k) => k + 1);
                }}
            />
        );
    }

    const showEmpty = !loading && totalItems === 0 && !hasActiveFilters;

    return (
        <div className="led-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Asientos contables. Crea notas de contabilidad manuales y contabilízalas.
            </p>

            {filtersMobileDrawer}

            <div className="led-section__toolbar">
                <button type="button" className="btn-primary" onClick={() => setEditing("")}>
                    <i className="ri-add-line" aria-hidden /> Nuevo comprobante
                </button>
                <button type="button" className="btn-secondary" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading || isPageFetching}>
                    <i className="ri-refresh-line" aria-hidden /> Refrescar
                </button>
            </div>

            {loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    Cargando comprobantes…
                </div>
            ) : showEmpty ? (
                <div className="purchases-empty">
                    <i className="ri-file-list-3-line" />
                    <p>No hay comprobantes. Crea uno con &quot;Nuevo comprobante&quot;.</p>
                </div>
            ) : (
                <>
                    <PaginationToolbar
                        position="top"
                        page={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
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
                        emptyLabel={totalItems === 0 ? "Sin comprobantes" : undefined}
                    />
                    {totalItems === 0 ? (
                        <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                            No hay comprobantes que coincidan con los filtros
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
                                emptyLabel={totalItems === 0 ? "Sin comprobantes" : undefined}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default JournalEntries;
