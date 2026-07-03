import { useCallback, useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import {
    getRetentionParties,
    getExogena,
    getExogenaValidacion,
    downloadRetentionCertificate,
    downloadExogenaXml,
    type RetentionParty,
    type ExogenaResponse,
    type ExogenaValidacionRow,
} from "../dian.service";
import { downloadRowsXlsx } from "../../accounting/import.utils";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { useClientPagination } from "../hooks/useClientPagination";
import { formatMoney, thisYear } from "../ledgerFormat";

const DianExogena: React.FC = () => {
    const [tab, setTab] = useState<"certificados" | "exogena">("certificados");
    const [anio, setAnio] = useState(thisYear());
    const [parties, setParties] = useState<RetentionParty[]>([]);
    const [exo, setExo] = useState<ExogenaResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [validaciones, setValidaciones] = useState<ExogenaValidacionRow[] | null>(null);
    const [validando, setValidando] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    const partiesPagination = useClientPagination(parties, [tab, anio, parties.length]);
    const validPagination = useClientPagination(validaciones ?? [], [validaciones?.length ?? 0]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (tab === "certificados") {
                const res = await getRetentionParties(anio);
                setParties(res.parties);
            } else {
                setValidaciones(null);
                setExo(await getExogena(anio));
            }
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [tab, anio]);

    useEffect(() => {
        load();
    }, [load]);

    const onCert = async (tercero: string) => {
        setBusy(tercero);
        try {
            await downloadRetentionCertificate(anio, tercero);
            successToast("Certificado generado");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusy(null);
        }
    };

    const exportFormato = (codigo: string) => {
        if (!exo) return;
        const f = exo.formatos[codigo];
        if (!f?.rows.length) {
            errorToast("Sin datos para exportar");
            return;
        }
        downloadRowsXlsx(
            `exogena-${codigo}-${anio}.xlsx`,
            ["NIT", "DV", "Tipo doc", "Tercero", "Municipio", "Identificado", "Valor"],
            f.rows.map((r) => [r.nit, r.dv ?? "", r.tipo_doc ?? "", r.tercero, r.municipio ?? "", r.identificado ? "Sí" : "No", String(r.valor)]),
            `Formato ${codigo}`,
        );
    };

    const exportXml = async (codigo: string) => {
        try {
            await downloadExogenaXml(anio, codigo);
            successToast("XML generado");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al generar el XML");
        }
    };

    const validar = async () => {
        setValidando(true);
        try {
            const res = await getExogenaValidacion(anio);
            setValidaciones(res.validaciones);
            const conAlerta = res.validaciones.filter((v) => !v.cuadra).length;
            if (conAlerta === 0) successToast("Todos los formatos cuadran ✓");
            else errorToast(`${conAlerta} formato(s) con alertas. Revisa el detalle.`);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al validar");
        } finally {
            setValidando(false);
        }
    };

    const renderCertActions = (p: RetentionParty, layout: "table" | "list" | "cards" = "table") => (
        <button type="button" className="btn-action" onClick={() => onCert(p.tercero)} disabled={busy === p.tercero}>
            <i className="ri-file-pdf-line" aria-hidden /> {busy === p.tercero ? "Generando..." : layout === "table" ? "Certificado PDF" : "PDF"}
        </button>
    );

    const renderPartiesTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Tercero</th>
                        <th>Conceptos</th>
                        <th className="ds-num">Total retenido</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {partiesPagination.paginated.map((p) => (
                        <tr key={p.tercero}>
                            <td data-label="Tercero">{p.tercero}</td>
                            <td data-label="Conceptos" style={{ color: "var(--text-muted)", fontSize: ".85rem" }}>
                                {p.conceptos.map((c) => c.descripcion || c.cuenta).join(", ")}
                            </td>
                            <td data-label="Total retenido" className="ds-num"><strong>{formatMoney(p.total_retenido)}</strong></td>
                            <td style={{ textAlign: "right" }}>{renderCertActions(p)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderPartiesList = () => (
        <div className="purchases-list-view">
            {partiesPagination.paginated.map((p) => (
                <article key={p.tercero} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{p.tercero}</strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(p.total_retenido)}</span>
                        </div>
                        <div className="purchases-list-item__sub" style={{ color: "var(--text-muted)", fontSize: ".85rem" }}>
                            {p.conceptos.map((c) => c.descripcion || c.cuenta).join(", ")}
                        </div>
                    </div>
                    <footer className="purchases-list-item__actions">{renderCertActions(p, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderPartiesCards = () => (
        <div className="purchases-cards-view">
            {partiesPagination.paginated.map((p) => (
                <article key={p.tercero} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{p.tercero}</strong>
                        <span className="purchases-card__amount-badge">{formatMoney(p.total_retenido)}</span>
                    </div>
                    <div className="purchases-card__sub" style={{ color: "var(--text-muted)", fontSize: ".85rem" }}>
                        {p.conceptos.map((c) => c.descripcion || c.cuenta).join(", ")}
                    </div>
                    <footer className="purchases-card__actions">{renderCertActions(p, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderPartiesView = () => {
        if (effectiveViewMode === "list") return renderPartiesList();
        if (effectiveViewMode === "cards") return renderPartiesCards();
        return renderPartiesTable();
    };

    const renderValidBadge = (v: ExogenaValidacionRow) =>
        v.cuadra ? (
            <span className="status-badge status-paid">Cuadra ✓</span>
        ) : (
            <span className="status-badge status-rejected">Revisar</span>
        );

    const renderValidTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Formato</th>
                        <th className="ds-num">Contable</th>
                        <th className="ds-num">Formato</th>
                        <th className="ds-num">Identificado (XML)</th>
                        <th className="ds-num">Diferencia</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {validPagination.paginated.map((v) => (
                        <tr key={v.codigo}>
                            <td data-label="Formato">
                                <strong>{v.codigo}</strong> {v.nombre}
                            </td>
                            <td data-label="Contable" className="ds-num">{formatMoney(v.total_contable)}</td>
                            <td data-label="Formato" className="ds-num">{formatMoney(v.total_formato)}</td>
                            <td data-label="Identificado (XML)" className="ds-num">{formatMoney(v.total_identificado)}</td>
                            <td data-label="Diferencia" className="ds-num" style={{ color: Math.abs(v.diferencia) > 1 ? "var(--tertiary-color)" : undefined }}>
                                {formatMoney(v.diferencia)}
                            </td>
                            <td data-label="Estado">{renderValidBadge(v)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderValidList = () => (
        <div className="purchases-list-view">
            {validPagination.paginated.map((v) => (
                <article key={v.codigo} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{v.codigo} — {v.nombre}</strong>
                            {renderValidBadge(v)}
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field"><dt>Contable</dt><dd>{formatMoney(v.total_contable)}</dd></div>
                            <div className="purchases-list-item__field"><dt>Formato</dt><dd>{formatMoney(v.total_formato)}</dd></div>
                            <div className="purchases-list-item__field"><dt>Diferencia</dt><dd>{formatMoney(v.diferencia)}</dd></div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderValidCards = () => (
        <div className="purchases-cards-view">
            {validPagination.paginated.map((v) => (
                <article key={v.codigo} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{v.codigo}</strong>
                        {renderValidBadge(v)}
                    </div>
                    <div className="purchases-card__sub">{v.nombre}</div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field"><dt>Contable</dt><dd>{formatMoney(v.total_contable)}</dd></div>
                        <div className="purchases-card__field"><dt>Formato</dt><dd>{formatMoney(v.total_formato)}</dd></div>
                        <div className="purchases-card__field purchases-card__field--full"><dt>Diferencia</dt><dd>{formatMoney(v.diferencia)}</dd></div>
                    </dl>
                </article>
            ))}
        </div>
    );

    const renderValidView = () => {
        if (effectiveViewMode === "list") return renderValidList();
        if (effectiveViewMode === "cards") return renderValidCards();
        return renderValidTable();
    };

    const paginationToolbarProps = {
        viewMode,
        onViewModeChange: setViewMode,
        showViewToggle: true as const,
    };

    return (
        <div className="led-section">
            <p className="pm-hint">Certificados de retención por tercero y formatos de información exógena (medios magnéticos) para revisión.</p>

            <div className="led-section__toolbar">
                <FilterField label="Año gravable" htmlFor="dian-anio" icon="ri-calendar-line">
                    <FieldControl id="dian-anio" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value) || thisYear())} />
                </FilterField>
            </div>

            <div className="led-tabs led-tabs--ds">
                <button type="button" className={tab === "certificados" ? "active" : ""} onClick={() => setTab("certificados")}>
                    Certificados de retención
                </button>
                <button type="button" className={tab === "exogena" ? "active" : ""} onClick={() => setTab("exogena")}>
                    Información exógena
                </button>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : tab === "certificados" ? (
                parties.length === 0 ? (
                    <p className="pm-hint">
                        No hay retenciones practicadas en {anio}. Configura los conceptos de retención (con su cuenta) y contabiliza comprobantes que las apliquen.
                    </p>
                ) : (
                    <>
                        <PaginationToolbar
                            position="top"
                            page={partiesPagination.page}
                            totalPages={partiesPagination.totalPages}
                            totalItems={partiesPagination.totalItems}
                            pageSize={partiesPagination.pageSize}
                            pageSizeOptions={partiesPagination.PAGE_SIZE_OPTIONS}
                            rangeStart={partiesPagination.start}
                            rangeEnd={partiesPagination.end}
                            onPageChange={partiesPagination.handlePageChange}
                            onPageSizeChange={partiesPagination.handlePageSizeChange}
                            {...paginationToolbarProps}
                        />
                        {renderPartiesView()}
                    </>
                )
            ) : !exo ? null : (
                <div>
                    <div className="dian-validacion-bar">
                        <button type="button" className="btn-secondary" onClick={validar} disabled={validando}>
                            <i className="ri-shield-check-line" aria-hidden /> {validando ? "Validando..." : "Validar cuadres"}
                        </button>
                        <span className="pm-hint">Compara cada formato contra la contabilidad y detecta terceros sin NIT antes de presentar.</span>
                    </div>

                    {validaciones && validaciones.length > 0 && (
                        <div className="dian-validacion">
                            <PaginationToolbar
                                position="top"
                                page={validPagination.page}
                                totalPages={validPagination.totalPages}
                                totalItems={validPagination.totalItems}
                                pageSize={validPagination.pageSize}
                                pageSizeOptions={validPagination.PAGE_SIZE_OPTIONS}
                                rangeStart={validPagination.start}
                                rangeEnd={validPagination.end}
                                onPageChange={validPagination.handlePageChange}
                                onPageSizeChange={validPagination.handlePageSizeChange}
                                {...paginationToolbarProps}
                            />
                            {renderValidView()}
                            {validaciones.some((v) => v.alertas.length > 0) && (
                                <ul className="dian-validacion__alertas">
                                    {validaciones.flatMap((v) =>
                                        v.alertas.map((a, i) => (
                                            <li key={`${v.codigo}-${i}`}>
                                                <strong>{v.codigo}:</strong> {a}
                                            </li>
                                        )),
                                    )}
                                </ul>
                            )}
                        </div>
                    )}

                    {Object.entries(exo.formatos).map(([codigo, f]) => (
                        <div key={codigo} className="dian-formato">
                            <div className="dian-formato__head">
                                <div>
                                    <strong>Formato {codigo}</strong> — {f.nombre}
                                    <span className="dian-formato__count">{f.rows.length} registro(s)</span>
                                    {f.sin_identificar > 0 && (
                                        <span className="dian-formato__count" style={{ background: "rgba(255,75,75,.12)", color: "var(--tertiary-color)" }}>
                                            {f.sin_identificar} sin NIT
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button type="button" className="btn-secondary" onClick={() => exportFormato(codigo)} disabled={!f.rows.length}>
                                        <i className="ri-file-excel-2-line" aria-hidden /> Excel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => exportXml(codigo)}
                                        disabled={!f.identificados}
                                        title={f.identificados ? "Genera el XML oficial DIAN (solo terceros con NIT)" : "No hay terceros identificados con NIT"}
                                    >
                                        <i className="ri-code-s-slash-line" aria-hidden /> XML DIAN
                                    </button>
                                </div>
                            </div>
                            {f.rows.length > 0 && (
                                <div className="purchases-table-container ds-table-container">
                                    <table className="purchases-table ds-table">
                                        <thead>
                                            <tr>
                                                <th>NIT</th>
                                                <th>Tercero</th>
                                                <th className="ds-num">Valor</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {f.rows.slice(0, 8).map((r, i) => (
                                                <tr key={i}>
                                                    <td data-label="NIT">{r.nit || "—"}</td>
                                                    <td data-label="Tercero">{r.tercero}</td>
                                                    <td data-label="Valor" className="ds-num">{formatMoney(r.valor)}</td>
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
                            )}
                            {f.rows.length > 8 && (
                                <p className="pm-hint" style={{ marginTop: 4 }}>
                                    … y {f.rows.length - 8} más. Exporta a Excel para ver el detalle completo.
                                </p>
                            )}
                        </div>
                    ))}
                    <p className="pm-hint" style={{ marginTop: 12 }}>
                        El XML oficial DIAN incluye solo los terceros con NIT identificado en el maestro de terceros. Los marcados &quot;sin NIT&quot; debes completarlos en Terceros antes de presentar.
                    </p>
                </div>
            )}
        </div>
    );
};

export default DianExogena;
