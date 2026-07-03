import { useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../inventory/page/Inventory.css";
import { getConciliacionFiscal, type ConciliacionFiscalPartida } from "../budget.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { useClientPagination } from "../hooks/useClientPagination";
import { formatMoney, yearStartIso, todayIso } from "../ledgerFormat";

const ConciliacionFiscal: React.FC = () => {
    const [desde, setDesde] = useState(yearStartIso());
    const [hasta, setHasta] = useState(todayIso());
    const [partidas, setPartidas] = useState<ConciliacionFiscalPartida[]>([]);
    const [resumen, setResumen] = useState<{ gastos_no_deducibles: number; nota: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

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
    } = useClientPagination(partidas, [loaded, partidas.length]);

    const generar = async () => {
        setLoading(true);
        try {
            const res = await getConciliacionFiscal(desde, hasta);
            setPartidas(res.partidas || []);
            setResumen(res.resumen || { gastos_no_deducibles: 0, nota: "" });
            setLoaded(true);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al generar la conciliación fiscal");
        } finally {
            setLoading(false);
        }
    };

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Cuenta</th>
                        <th>Nombre</th>
                        <th className="ds-num">Saldo contable</th>
                        <th>Tipo</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((p, i) => (
                        <tr key={`${p.cuenta}-${i}`}>
                            <td data-label="Cuenta">{p.cuenta}</td>
                            <td data-label="Nombre">{p.nombre}</td>
                            <td data-label="Saldo contable" className="ds-num">{formatMoney(p.saldo_contable)}</td>
                            <td data-label="Tipo">{p.tipo}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((p, i) => (
                <article key={`${p.cuenta}-${i}`} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{p.cuenta} — {p.nombre}</strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(p.saldo_contable)}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field"><dt>Tipo</dt><dd>{p.tipo}</dd></div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((p, i) => (
                <article key={`${p.cuenta}-${i}`} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{p.cuenta}</strong>
                        <span className="purchases-card__amount-badge">{formatMoney(p.saldo_contable)}</span>
                    </div>
                    <div className="purchases-card__sub">{p.nombre}</div>
                    <dl className="purchases-card__fields">
                        <div className="purchases-card__field"><dt>Tipo</dt><dd>{p.tipo}</dd></div>
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

    return (
        <div className="led-section">
            <p className="pm-hint">Diferencias entre la contabilidad financiera y la base fiscal en el rango de fechas.</p>

            <div className="led-form-grid">
                <FilterField label="Desde" htmlFor="cf-desde" icon="ri-calendar-line">
                    <FieldControl id="cf-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </FilterField>
                <FilterField label="Hasta" htmlFor="cf-hasta" icon="ri-calendar-line">
                    <FieldControl id="cf-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </FilterField>
            </div>
            <div className="led-form-actions">
                <button type="button" className="btn-primary" onClick={generar} disabled={loading}>
                    <i className="ri-git-merge-line" aria-hidden /> {loading ? "Generando..." : "Generar"}
                </button>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : !loaded ? (
                <p className="pm-hint">Selecciona el rango de fechas y pulsa &quot;Generar&quot;.</p>
            ) : (
                <>
                    {resumen && (
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                            <div className="inv-total-card" style={{ flex: "1 1 260px" }}>
                                <div>
                                    <span className="inv-total-card__label">Gastos no deducibles</span>
                                    <span className="inv-total-card__value">{formatMoney(resumen.gastos_no_deducibles)}</span>
                                </div>
                                <i className="ri-error-warning-line" />
                            </div>
                        </div>
                    )}
                    {resumen?.nota && <p className="pm-hint">{resumen.nota}</p>}

                    {partidas.length === 0 ? (
                        <p className="pm-hint">No hay partidas conciliatorias en el rango.</p>
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
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default ConciliacionFiscal;
