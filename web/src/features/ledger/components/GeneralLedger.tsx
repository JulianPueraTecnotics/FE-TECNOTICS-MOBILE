import { useCallback, useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getGeneralLedger, getAccountDetail, type LedgerRow, type AccountDetailRow } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    AppDrawer,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { formatAmount, formatDate, formatMoney, todayIso, yearStartIso } from "../ledgerFormat";
import { useClientPagination } from "../hooks/useClientPagination";

const GeneralLedger: React.FC = () => {
    const [desde, setDesde] = useState(yearStartIso());
    const [hasta, setHasta] = useState(todayIso());
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [drawerCuenta, setDrawerCuenta] = useState<string | null>(null);
    const [detailRows, setDetailRows] = useState<AccountDetailRow[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    useBodyScrollLock(!!drawerCuenta);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getGeneralLedger(desde, hasta);
            setRows(res.rows);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [desde, hasta]);

    useEffect(() => {
        load();
        setDrawerCuenta(null);
    }, [load]);

    const openDetail = useCallback(
        async (cuenta: string) => {
            setDrawerCuenta(cuenta);
            setDetailRows([]);
            setDetailLoading(true);
            try {
                const res = await getAccountDetail(cuenta, desde, hasta);
                setDetailRows(res.rows);
            } catch (e) {
                errorToast(e instanceof Error ? e.message : "Error");
                setDrawerCuenta(null);
            } finally {
                setDetailLoading(false);
            }
        },
        [desde, hasta],
    );

    const {
        page: safePage,
        pageSize,
        totalItems,
        totalPages,
        paginated,
        start,
        end,
        handlePageChange,
        handlePageSizeChange,
        PAGE_SIZE_OPTIONS,
    } = useClientPagination(rows, [desde, hasta]);

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Cuenta</th>
                        <th>Nombre</th>
                        <th className="ds-num">Saldo inicial</th>
                        <th className="ds-num">Débitos</th>
                        <th className="ds-num">Créditos</th>
                        <th className="ds-num">Saldo final</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((r) => (
                        <tr key={r.cuenta} className="ds-clickable-row" onClick={() => openDetail(r.cuenta)} style={{ cursor: "pointer" }}>
                            <td data-label="Cuenta">{r.cuenta}</td>
                            <td data-label="Nombre">{r.nombre}</td>
                            <td data-label="Saldo inicial" className="ds-num">
                                {formatAmount(r.saldo_inicial)}
                            </td>
                            <td data-label="Débitos" className="ds-num">
                                {r.debitos ? formatAmount(r.debitos) : ""}
                            </td>
                            <td data-label="Créditos" className="ds-num">
                                {r.creditos ? formatAmount(r.creditos) : ""}
                            </td>
                            <td data-label="Saldo final" className="ds-num">
                                <strong>{formatAmount(r.saldo_final)}</strong>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((r) => (
                <article
                    key={r.cuenta}
                    className="purchases-list-item ds-clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetail(r.cuenta)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetail(r.cuenta);
                        }
                    }}
                >
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">
                                {r.cuenta} · {r.nombre}
                            </strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(r.saldo_final)}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Saldo inicial</dt>
                                <dd>{formatAmount(r.saldo_inicial)}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Débitos</dt>
                                <dd>{r.debitos ? formatAmount(r.debitos) : "—"}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Créditos</dt>
                                <dd>{r.creditos ? formatAmount(r.creditos) : "—"}</dd>
                            </div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((r) => (
                <article
                    key={r.cuenta}
                    className="purchases-card ds-clickable-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetail(r.cuenta)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openDetail(r.cuenta);
                        }
                    }}
                >
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{r.cuenta}</strong>
                        <span className="purchases-card__amount-badge">{formatMoney(r.saldo_final)}</span>
                    </div>
                    <div className="purchases-card__sub">{r.nombre}</div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Saldo inicial</dt>
                            <dd>{formatAmount(r.saldo_inicial)}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Débitos</dt>
                            <dd>{r.debitos ? formatAmount(r.debitos) : "—"}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Créditos</dt>
                            <dd>{r.creditos ? formatAmount(r.creditos) : "—"}</dd>
                        </div>
                    </dl>
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

    return (
        <div className="led-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Saldo inicial, movimientos y saldo final por cuenta. Clic en una cuenta para ver su auxiliar.
            </p>

            <div className="led-form-grid">
                <FilterField label="Desde" htmlFor="led-gl-desde" icon="ri-calendar-line">
                    <FieldControl id="led-gl-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </FilterField>
                <FilterField label="Hasta" htmlFor="led-gl-hasta" icon="ri-calendar-line">
                    <FieldControl id="led-gl-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </FilterField>
            </div>

            <div className="led-section__toolbar">
                <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
                    <i className="ri-refresh-line" aria-hidden /> Refrescar
                </button>
            </div>

            {loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    Cargando libro mayor…
                </div>
            ) : showEmpty ? (
                <div className="purchases-empty">
                    <i className="ri-archive-line" />
                    <p>No hay movimientos en el rango.</p>
                </div>
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
                        isFetching={loading}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        showViewToggle
                        emptyLabel={totalItems === 0 ? "Sin cuentas" : undefined}
                    />
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
                        emptyLabel={totalItems === 0 ? "Sin cuentas" : undefined}
                    />
                </>
            )}

            {drawerCuenta && (
                <AppDrawer
                    wide
                    title={`Auxiliar — cuenta ${drawerCuenta}`}
                    titleIcon="ri-archive-line"
                    onClose={() => setDrawerCuenta(null)}
                    closeDisabled={detailLoading}
                    footer={
                        <button type="button" className="export-cancel" onClick={() => setDrawerCuenta(null)} disabled={detailLoading}>
                            Cerrar
                        </button>
                    }
                >
                    {detailLoading ? (
                        <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 24 }}>
                            Cargando auxiliar…
                        </div>
                    ) : detailRows.length === 0 ? (
                        <p className="pm-hint">Sin movimientos.</p>
                    ) : (
                        <div className="purchases-table-container ds-table-container">
                            <table className="purchases-table ds-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Comp.</th>
                                        <th>Tercero</th>
                                        <th>Descripción</th>
                                        <th className="ds-num">Débito</th>
                                        <th className="ds-num">Crédito</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detailRows.map((m, i) => (
                                        <tr key={i}>
                                            <td data-label="Fecha">{formatDate(m.fecha)}</td>
                                            <td data-label="Comp.">
                                                {m.tipo}-{m.consecutivo}
                                            </td>
                                            <td data-label="Tercero">{m.tercero || "—"}</td>
                                            <td data-label="Descripción">{m.linea_desc || m.descripcion || ""}</td>
                                            <td data-label="Débito" className="ds-num">
                                                {m.debito ? formatAmount(m.debito) : ""}
                                            </td>
                                            <td data-label="Crédito" className="ds-num">
                                                {m.credito ? formatAmount(m.credito) : ""}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </AppDrawer>
            )}
        </div>
    );
};

export default GeneralLedger;
