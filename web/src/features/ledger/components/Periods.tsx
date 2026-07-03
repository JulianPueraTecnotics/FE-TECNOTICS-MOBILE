import { useCallback, useEffect, useMemo, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getPeriods, setPeriod } from "../ledger.service";
import type { AccountingPeriod } from "../ledger.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLedgerFiltersPanel } from "../hooks/useLedgerFiltersPanel";

const STATUS_CLS: Record<string, string> = { abierto: "status-paid", cerrado: "status-pending", bloqueado: "status-rejected" };
const STATUS_LABEL: Record<string, string> = { abierto: "Abierto", cerrado: "Cerrado", bloqueado: "Bloqueado" };
const thisMonth = () => new Date().toISOString().slice(0, 7);

type EstadoFilter = "" | "abierto" | "cerrado" | "bloqueado";

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "periodo", label: "Período", type: "text", icon: "ri-calendar-line" },
    { id: "estado", label: "Estado", type: "select", icon: "ri-toggle-line", options: [{ value: "abierto", label: "Abierto" }, { value: "cerrado", label: "Cerrado" }, { value: "bloqueado", label: "Bloqueado" }], serverSide: true },
];

const Periods: React.FC = () => {
    const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState(thisMonth());
    const [filterEstado, setFilterEstado] = useState<EstadoFilter>("");
    const [busy, setBusy] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getPeriods();
            setPeriods(res.periods);
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
        if (!filterEstado) return periods;
        return periods.filter((p) => p.estado === filterEstado);
    }, [periods, filterEstado]);
    const getRowFilterValue = useCallback((row: AccountingPeriod, filterId: string): string => {
        switch (filterId) {
            case "periodo": return row.periodo ?? "";
            case "estado": return row.estado ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedPeriods = filterRows(filtered);

    const {
        page,
        pageSize,
        totalItems,
        totalPages,
        paginated,
        start,
        end,
        handlePageChange,
        handlePageSizeChange,
        PAGE_SIZE_OPTIONS,
    } = useClientPagination(displayedPeriods, [filterEstado, colFilterValues.periodo]);

    const hasActiveFilters = filterEstado !== "" || hasActiveClientFilters;
    const clearFilters = () => {
        setFilterEstado("");
        clearColFilters();
    };

    const { filtersToolbar, filtersMobileDrawer } = useLedgerFiltersPanel({
        panelId: "led-periods",
        title: "Filtrar períodos",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [filterEstado],
        filterContent: (
            <>
            <FilterField label="Estado" htmlFor="led-periods-estado" icon="ri-toggle-line">
                <FieldControl
                    id="led-periods-estado"
                    as="select"
                    value={filterEstado}
                    onChange={(e) => setFilterEstado(e.target.value as EstadoFilter)}
                >
                    <option value="">Todos</option>
                    <option value="abierto">Abierto</option>
                    <option value="cerrado">Cerrado</option>
                    <option value="bloqueado">Bloqueado</option>
                </FieldControl>
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="led-periods-col" />
            </>
        ),
    });

    const apply = async (p: string, estado: "abierto" | "cerrado" | "bloqueado") => {
        setBusy(true);
        try {
            await setPeriod(p, estado);
            successToast(`Período ${p} ${STATUS_LABEL[estado].toLowerCase()}`);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusy(false);
        }
    };

    const renderActions = (p: AccountingPeriod, layout: "table" | "list" | "cards" = "table") => (
        <div className={`led-row-actions ds-row-actions purchases-actions--${layout}`}>
            {p.estado !== "abierto" && (
                <button type="button" className="btn-action" onClick={() => apply(p.periodo, "abierto")} disabled={busy}>
                    <i className="ri-lock-unlock-line" aria-hidden />
                    {layout === "table" ? "Abrir" : null}
                </button>
            )}
            {p.estado !== "cerrado" && (
                <button type="button" className="btn-action" onClick={() => apply(p.periodo, "cerrado")} disabled={busy}>
                    <i className="ri-lock-line" aria-hidden />
                    {layout === "table" ? "Cerrar" : null}
                </button>
            )}
            {p.estado !== "bloqueado" && (
                <button type="button" className="btn-action" onClick={() => apply(p.periodo, "bloqueado")} disabled={busy}>
                    <i className="ri-forbid-line" aria-hidden />
                    {layout === "table" ? "Bloquear" : null}
                </button>
            )}
        </div>
    );

    const renderBadge = (p: AccountingPeriod) => (
        <span className={`status-badge ${STATUS_CLS[p.estado] ?? ""}`}>{STATUS_LABEL[p.estado]}</span>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Período</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((p) => (
                        <tr key={p._id}>
                            <td data-label="Período">{p.periodo}</td>
                            <td data-label="Estado">{renderBadge(p)}</td>
                            <td data-label="Acciones">{renderActions(p)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((p) => (
                <article key={p._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{p.periodo}</strong>
                            {renderBadge(p)}
                        </div>
                    </div>
                    <footer className="purchases-list-item__actions">{renderActions(p, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((p) => (
                <article key={p._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{p.periodo}</strong>
                        {renderBadge(p)}
                    </div>
                    <footer className="purchases-card__actions">{renderActions(p, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const showEmpty = !loading && periods.length === 0;
    const showNoResults = !loading && periods.length > 0 && totalItems === 0;

    return (
        <div className="led-section">
            <p className="pm-hint">
                Abre, cierra o bloquea meses. En un período cerrado/bloqueado no se permiten nuevos asientos.
            </p>

            {filtersMobileDrawer}

            <div className="led-section__toolbar">
                <FilterField label="Período" htmlFor="led-periods-month" icon="ri-calendar-line">
                    <FieldControl
                        id="led-periods-month"
                        type="month"
                        value={periodo}
                        onChange={(e) => setPeriodo(e.target.value)}
                    />
                </FilterField>
                <button type="button" className="btn-secondary" onClick={() => apply(periodo, "cerrado")} disabled={busy}>
                    <i className="ri-lock-line" aria-hidden /> Cerrar
                </button>
                <button type="button" className="btn-primary" onClick={() => apply(periodo, "abierto")} disabled={busy}>
                    <i className="ri-lock-unlock-line" aria-hidden /> Abrir
                </button>
                {filtersToolbar}
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : showEmpty ? (
                <p className="pm-hint">No hay períodos registrados. Por defecto, los meses sin registro están abiertos.</p>
            ) : showNoResults ? (
                <p className="pm-hint">Ningún período coincide con el filtro de estado.</p>
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
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        showViewToggle
                    />
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
                    />
                </>
            )}
        </div>
    );
};

export default Periods;
