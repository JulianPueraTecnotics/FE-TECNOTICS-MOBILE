import { useCallback, useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getIcaPorMunicipio, type IcaMunicipioResponse, type IcaTerceroRow } from "../dian.service";
import { downloadRowsXlsx } from "../../accounting/import.utils";
import { errorToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { useClientPagination } from "../hooks/useClientPagination";
import { formatMoney, thisYear } from "../ledgerFormat";

type MunicipioItem = IcaMunicipioResponse["municipios"][number];

const IcaMunicipio: React.FC = () => {
    const [anio, setAnio] = useState(thisYear());
    const [data, setData] = useState<IcaMunicipioResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    const municipios = data?.municipios ?? [];
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
    } = useClientPagination(municipios, [anio, municipios.length]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setData(await getIcaPorMunicipio(anio));
            setOpen(null);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar el ICA por municipio");
        } finally {
            setLoading(false);
        }
    }, [anio]);

    useEffect(() => {
        load();
    }, [load]);

    const exportAll = () => {
        if (!data?.municipios.length) {
            errorToast("Sin datos para exportar");
            return;
        }
        const rows = data.municipios.flatMap((m) =>
            m.rows.map((r) => [m.municipio, r.nit || "", r.dv ?? "", r.tercero, r.identificado ? "Sí" : "No", String(r.valor)]),
        );
        downloadRowsXlsx(
            `reteica-municipio-${anio}.xlsx`,
            ["Municipio", "NIT", "DV", "Tercero", "Identificado", "ReteICA"],
            rows,
            `ReteICA ${anio}`,
        );
    };

    const renderMunicipioLabel = (m: MunicipioItem) => {
        const sinMun = m.codigo_municipio === "—";
        if (sinMun) {
            return (
                <span title="Terceros sin código de municipio en su dirección">
                    <i className="ri-error-warning-line" style={{ color: "var(--tertiary-color)" }} aria-hidden /> Sin municipio
                </span>
            );
        }
        return (
            <>
                <strong>{m.codigo_municipio}</strong> — {m.municipio}
            </>
        );
    };

    const renderDetailTable = (rows: IcaTerceroRow[]) => (
        <div className="purchases-table-container ds-table-container" style={{ marginTop: 8 }}>
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>NIT</th>
                        <th>Tercero</th>
                        <th className="ds-num">ReteICA</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i}>
                            <td data-label="NIT">{r.nit || "—"}</td>
                            <td data-label="Tercero">{r.tercero}</td>
                            <td data-label="ReteICA" className="ds-num">{formatMoney(r.valor)}</td>
                            <td>
                                {r.identificado ? (
                                    <span className="status-badge status-paid">✓</span>
                                ) : (
                                    <span className="status-badge status-rejected" title="Sin NIT en el maestro de terceros">sin NIT</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const toggleDetail = (codigo: string) => setOpen((prev) => (prev === codigo ? null : codigo));

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Municipio</th>
                        <th className="ds-num">Terceros</th>
                        <th className="ds-num">ReteICA</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((m) => {
                        const isOpen = open === m.codigo_municipio;
                        return (
                            <>
                                <tr key={m.codigo_municipio}>
                                    <td data-label="Municipio">{renderMunicipioLabel(m)}</td>
                                    <td data-label="Terceros" className="ds-num">{m.terceros}</td>
                                    <td data-label="ReteICA" className="ds-num"><strong>{formatMoney(m.total)}</strong></td>
                                    <td style={{ textAlign: "right" }}>
                                        <button type="button" className="btn-action" onClick={() => toggleDetail(m.codigo_municipio)}>
                                            <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} aria-hidden /> {isOpen ? "Ocultar" : "Detalle"}
                                        </button>
                                    </td>
                                </tr>
                                {isOpen && (
                                    <tr key={`${m.codigo_municipio}-det`}>
                                        <td colSpan={4} style={{ background: "var(--bg-subtle, rgba(0,0,0,.02))", padding: "0.75rem 1rem" }}>
                                            {renderDetailTable(m.rows)}
                                        </td>
                                    </tr>
                                )}
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((m) => {
                const isOpen = open === m.codigo_municipio;
                return (
                    <article key={m.codigo_municipio} className="purchases-list-item">
                        <div className="purchases-list-item__body">
                            <div className="purchases-list-item__head">
                                <strong className="purchases-list-item__title">{renderMunicipioLabel(m)}</strong>
                                <span className="purchases-list-item__amount-badge">{formatMoney(m.total)}</span>
                            </div>
                            <div className="purchases-list-item__sub">{m.terceros} tercero(s)</div>
                            {isOpen && renderDetailTable(m.rows)}
                        </div>
                        <footer className="purchases-list-item__actions">
                            <button type="button" className="btn-action" onClick={() => toggleDetail(m.codigo_municipio)}>
                                <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} aria-hidden /> {isOpen ? "Ocultar" : "Detalle"}
                            </button>
                        </footer>
                    </article>
                );
            })}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((m) => {
                const isOpen = open === m.codigo_municipio;
                return (
                    <article key={m.codigo_municipio} className="purchases-card">
                        <div className="purchases-card__header">
                            <strong className="purchases-card__title">{m.municipio || "Sin municipio"}</strong>
                            <span className="purchases-card__amount-badge">{formatMoney(m.total)}</span>
                        </div>
                        <div className="purchases-card__sub">{m.terceros} tercero(s)</div>
                        {isOpen && renderDetailTable(m.rows)}
                        <footer className="purchases-card__actions">
                            <button type="button" className="btn-action" onClick={() => toggleDetail(m.codigo_municipio)}>
                                <i className={isOpen ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} aria-hidden /> {isOpen ? "Ocultar" : "Detalle"}
                            </button>
                        </footer>
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

    return (
        <div className="led-section">
            <p className="pm-hint">
                Retención de ICA practicada, agrupada por el municipio del tercero. Insumo para la exógena distrital (Bogotá, Medellín, Cali, etc.).
            </p>

            <div className="led-section__toolbar">
                <FilterField label="Año gravable" htmlFor="ica-anio" icon="ri-calendar-line">
                    <FieldControl id="ica-anio" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value) || thisYear())} />
                </FilterField>
                <button type="button" className="btn-secondary" onClick={exportAll} disabled={!data?.municipios.length}>
                    <i className="ri-file-excel-2-line" aria-hidden /> Excel
                </button>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : !data || data.municipios.length === 0 ? (
                <p className="pm-hint">
                    No hay ReteICA practicada en {anio}. Configura conceptos de retención tipo <strong>ICA</strong> (con su cuenta, normalmente 2368xx) y contabiliza compras que la apliquen.
                </p>
            ) : (
                <>
                    <div className="ica-summary" style={{ display: "flex", gap: 16, margin: "0 0 12px", flexWrap: "wrap" }}>
                        <div className="ica-kpi">
                            <span className="pm-hint">Total ReteICA {anio}</span>
                            <strong style={{ fontSize: "1.25rem", display: "block" }}>{formatMoney(data.total)}</strong>
                        </div>
                        <div className="ica-kpi">
                            <span className="pm-hint">Municipios</span>
                            <strong style={{ fontSize: "1.25rem", display: "block" }}>{data.municipios.length}</strong>
                        </div>
                        {data.sin_identificar > 0 && (
                            <div className="ica-kpi">
                                <span className="pm-hint">Terceros sin NIT</span>
                                <strong style={{ fontSize: "1.25rem", display: "block", color: "var(--tertiary-color)" }}>{data.sin_identificar}</strong>
                            </div>
                        )}
                    </div>

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
                    <p className="pm-hint" style={{ marginTop: 12 }}>
                        El municipio se toma del código de municipio de la dirección del tercero. Los que aparecen en <strong>&quot;Sin municipio&quot;</strong> debes completarlos en Terceros para que la exógena distrital quede correcta.
                    </p>
                </>
            )}
        </div>
    );
};

export default IcaMunicipio;
