import { useCallback, useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../inventory/page/Inventory.css";
import {
    getBudget,
    upsertBudget,
    deleteBudget,
    getBudgetExecution,
    type BudgetLine,
    type BudgetExecutionRow,
    type Escenario,
} from "../budget.service";
import { getCostCenters } from "../../accounting/accounting.service";
import type { CostCenter } from "../../accounting/accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    useConfirm,
    type ViewMode,
} from "../../../components/design-system";
import { useClientPagination } from "../hooks/useClientPagination";
import { formatMoney, thisYear } from "../ledgerFormat";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ESCENARIOS: Escenario[] = ["base", "optimista", "pesimista"];
const emptyMonths = (): number[] => Array(12).fill(0);

const Budget: React.FC = () => {
    const { confirm } = useConfirm();
    const [anio, setAnio] = useState(thisYear());
    const [escenario, setEscenario] = useState<Escenario>("base");
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    const [rows, setRows] = useState<BudgetExecutionRow[]>([]);
    const [totales, setTotales] = useState({ presupuestado: 0, ejecutado: 0, desviacion: 0 });
    const [loadingExec, setLoadingExec] = useState(false);
    const [execLoaded, setExecLoaded] = useState(false);

    const [lines, setLines] = useState<BudgetLine[]>([]);
    const [loadingLines, setLoadingLines] = useState(true);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

    const [cuenta, setCuenta] = useState("");
    const [centroCostoId, setCentroCostoId] = useState("");
    const [valorMensual, setValorMensual] = useState<number>(0);
    const [meses, setMeses] = useState<number[]>(emptyMonths());
    const [saving, setSaving] = useState(false);

    const loadLines = useCallback(async () => {
        setLoadingLines(true);
        try {
            setLines(await getBudget(anio, escenario));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar el presupuesto");
        } finally {
            setLoadingLines(false);
        }
    }, [anio, escenario]);

    useEffect(() => {
        loadLines();
    }, [loadLines]);

    useEffect(() => {
        getCostCenters()
            .then((r) => setCostCenters(r.cost_centers || []))
            .catch(() => setCostCenters([]));
    }, []);

    const execPagination = useClientPagination(rows, [execLoaded, rows.length]);
    const linesPagination = useClientPagination(lines, [anio, escenario, lines.length]);

    const calcular = async () => {
        setLoadingExec(true);
        try {
            const res = await getBudgetExecution(anio, escenario, centroCostoId || undefined);
            setRows(res.rows || []);
            setTotales(res.totales || { presupuestado: 0, ejecutado: 0, desviacion: 0 });
            setExecLoaded(true);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al calcular la ejecución");
        } finally {
            setLoadingExec(false);
        }
    };

    const repartirIgual = () => setMeses(Array(12).fill(valorMensual || 0));
    const setMes = (i: number, v: number) => setMeses((prev) => prev.map((m, idx) => (idx === i ? v : m)));

    const resetForm = () => {
        setCuenta("");
        setCentroCostoId("");
        setValorMensual(0);
        setMeses(emptyMonths());
    };

    const guardar = async () => {
        if (!cuenta.trim()) {
            errorToast("Indica el código de cuenta");
            return;
        }
        const efectivos = meses.some((m) => Number(m) > 0) ? meses : Array(12).fill(valorMensual || 0);
        if (!efectivos.some((m) => Number(m) > 0)) {
            errorToast("Ingresa al menos un valor de presupuesto");
            return;
        }
        setSaving(true);
        try {
            await upsertBudget({
                anio,
                escenario,
                cuenta: cuenta.trim(),
                ...(centroCostoId ? { centro_costo_id: centroCostoId } : {}),
                meses: efectivos.map((m) => Number(m) || 0),
            });
            successToast("Línea de presupuesto guardada");
            resetForm();
            loadLines();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const editar = (l: BudgetLine) => {
        setCuenta(l.cuenta);
        setCentroCostoId(l.centro_costo_id || "");
        setMeses(l.meses && l.meses.length === 12 ? [...l.meses] : emptyMonths());
        setValorMensual(0);
    };

    const eliminar = async (l: BudgetLine) => {
        if (!(await confirm(`¿Eliminar la línea de presupuesto de la cuenta ${l.cuenta}?`))) return;
        try {
            await deleteBudget(l._id);
            successToast("Línea eliminada");
            loadLines();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al eliminar");
        }
    };

    const ccLabel = (id?: string | null) => {
        if (!id) return "—";
        const cc = costCenters.find((c) => c._id === id);
        return cc ? `${cc.codigo} · ${cc.descripcion}` : id;
    };

    const lineTotal = (l: BudgetLine) => (l.meses || []).reduce((a, b) => a + (Number(b) || 0), 0);

    const renderCumplimiento = (r: BudgetExecutionRow) => {
        const ok = r.cumplimiento >= 90 && r.cumplimiento <= 110;
        return (
            <span
                style={{
                    display: "inline-block",
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontWeight: 600,
                    fontSize: "0.8rem",
                    background: ok ? "rgba(46, 184, 138, 0.15)" : "rgba(245, 166, 35, 0.18)",
                    color: ok ? "var(--accent-teal)" : "var(--tertiary-color)",
                }}
            >
                {(r.cumplimiento || 0).toFixed(1)}%
            </span>
        );
    };

    const renderExecActions = (l: BudgetLine, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            <button type="button" className="btn-action" title="Editar" onClick={() => editar(l)}>
                <i className="ri-edit-line" aria-hidden />
                {layout === "table" ? "Editar" : null}
            </button>
            <button type="button" className="btn-action" title="Eliminar" onClick={() => eliminar(l)}>
                <i className="ri-delete-bin-line" aria-hidden />
                {layout === "table" ? "Eliminar" : null}
            </button>
        </div>
    );

    const renderExecTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Cuenta</th>
                        <th>Nombre</th>
                        <th className="ds-num">Presupuestado</th>
                        <th className="ds-num">Ejecutado</th>
                        <th className="ds-num">Desviación</th>
                        <th style={{ textAlign: "center" }}>Cumplimiento</th>
                    </tr>
                </thead>
                <tbody>
                    {execPagination.paginated.map((r) => (
                        <tr key={`${r.cuenta}-${r.centro_costo_id ?? ""}`}>
                            <td data-label="Cuenta">{r.cuenta}</td>
                            <td data-label="Nombre">{r.cuenta_nombre}</td>
                            <td data-label="Presupuestado" className="ds-num">{formatMoney(r.presupuestado)}</td>
                            <td data-label="Ejecutado" className="ds-num">{formatMoney(r.ejecutado)}</td>
                            <td data-label="Desviación" className="ds-num">{formatMoney(r.desviacion)}</td>
                            <td data-label="Cumplimiento" style={{ textAlign: "center" }}>{renderCumplimiento(r)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderExecList = () => (
        <div className="purchases-list-view">
            {execPagination.paginated.map((r) => (
                <article key={`${r.cuenta}-${r.centro_costo_id ?? ""}`} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{r.cuenta} — {r.cuenta_nombre}</strong>
                            {renderCumplimiento(r)}
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field"><dt>Presupuestado</dt><dd>{formatMoney(r.presupuestado)}</dd></div>
                            <div className="purchases-list-item__field"><dt>Ejecutado</dt><dd>{formatMoney(r.ejecutado)}</dd></div>
                            <div className="purchases-list-item__field"><dt>Desviación</dt><dd>{formatMoney(r.desviacion)}</dd></div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderExecCards = () => (
        <div className="purchases-cards-view">
            {execPagination.paginated.map((r) => (
                <article key={`${r.cuenta}-${r.centro_costo_id ?? ""}`} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{r.cuenta}</strong>
                        {renderCumplimiento(r)}
                    </div>
                    <div className="purchases-card__sub">{r.cuenta_nombre}</div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field"><dt>Presupuestado</dt><dd>{formatMoney(r.presupuestado)}</dd></div>
                        <div className="purchases-card__field"><dt>Ejecutado</dt><dd>{formatMoney(r.ejecutado)}</dd></div>
                        <div className="purchases-card__field purchases-card__field--full"><dt>Desviación</dt><dd>{formatMoney(r.desviacion)}</dd></div>
                    </dl>
                </article>
            ))}
        </div>
    );

    const renderLinesTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Cuenta</th>
                        <th>Centro de costo</th>
                        <th className="ds-num">Total anual</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {linesPagination.paginated.map((l) => (
                        <tr key={l._id}>
                            <td data-label="Cuenta">{l.cuenta}</td>
                            <td data-label="Centro de costo">{ccLabel(l.centro_costo_id)}</td>
                            <td data-label="Total anual" className="ds-num"><strong>{formatMoney(lineTotal(l))}</strong></td>
                            <td data-label="Acciones">{renderExecActions(l)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderLinesList = () => (
        <div className="purchases-list-view">
            {linesPagination.paginated.map((l) => (
                <article key={l._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{l.cuenta}</strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(lineTotal(l))}</span>
                        </div>
                        <div className="purchases-list-item__sub">{ccLabel(l.centro_costo_id)}</div>
                    </div>
                    <footer className="purchases-list-item__actions">{renderExecActions(l, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderLinesCards = () => (
        <div className="purchases-cards-view">
            {linesPagination.paginated.map((l) => (
                <article key={l._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{l.cuenta}</strong>
                        <span className="purchases-card__amount-badge">{formatMoney(lineTotal(l))}</span>
                    </div>
                    <div className="purchases-card__sub">{ccLabel(l.centro_costo_id)}</div>
                    <footer className="purchases-card__actions">{renderExecActions(l, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderExecView = () => {
        if (effectiveViewMode === "list") return renderExecList();
        if (effectiveViewMode === "cards") return renderExecCards();
        return renderExecTable();
    };

    const renderLinesView = () => {
        if (effectiveViewMode === "list") return renderLinesList();
        if (effectiveViewMode === "cards") return renderLinesCards();
        return renderLinesTable();
    };

    const paginationToolbarProps = {
        viewMode,
        onViewModeChange: setViewMode,
        showViewToggle: true as const,
    };

    return (
        <div className="led-section">
            <p className="pm-hint">Define el presupuesto por cuenta y escenario, y compara contra la ejecución real del período.</p>

            <div className="led-section__toolbar">
                <FilterField label="Año" htmlFor="budget-anio" icon="ri-calendar-line">
                    <FieldControl
                        id="budget-anio"
                        type="number"
                        value={anio}
                        onChange={(e) => setAnio(Number(e.target.value) || thisYear())}
                    />
                </FilterField>
                <FilterField label="Escenario" htmlFor="budget-escenario" icon="ri-stack-line">
                    <FieldControl
                        id="budget-escenario"
                        as="select"
                        value={escenario}
                        onChange={(e) => setEscenario(e.target.value as Escenario)}
                    >
                        {ESCENARIOS.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                    </FieldControl>
                </FilterField>
                <button type="button" className="btn-primary" onClick={calcular} disabled={loadingExec}>
                    <i className="ri-bar-chart-grouped-line" aria-hidden /> {loadingExec ? "Calculando..." : "Calcular ejecución"}
                </button>
            </div>

            {loadingExec ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : execLoaded ? (
                rows.length === 0 ? (
                    <p className="pm-hint">No hay presupuesto cargado para {anio} ({escenario}).</p>
                ) : (
                    <>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                            <div className="inv-total-card" style={{ flex: "1 1 200px" }}>
                                <div>
                                    <span className="inv-total-card__label">Presupuestado</span>
                                    <span className="inv-total-card__value">{formatMoney(totales.presupuestado)}</span>
                                </div>
                                <i className="ri-pie-chart-line" />
                            </div>
                            <div className="inv-total-card" style={{ flex: "1 1 200px" }}>
                                <div>
                                    <span className="inv-total-card__label">Ejecutado</span>
                                    <span className="inv-total-card__value">{formatMoney(totales.ejecutado)}</span>
                                </div>
                                <i className="ri-money-dollar-circle-line" />
                            </div>
                            <div className="inv-total-card" style={{ flex: "1 1 200px" }}>
                                <div>
                                    <span className="inv-total-card__label">Desviación</span>
                                    <span className="inv-total-card__value">{formatMoney(totales.desviacion)}</span>
                                </div>
                                <i className="ri-line-chart-line" />
                            </div>
                        </div>
                        <PaginationToolbar
                            position="top"
                            page={execPagination.page}
                            totalPages={execPagination.totalPages}
                            totalItems={execPagination.totalItems}
                            pageSize={execPagination.pageSize}
                            pageSizeOptions={execPagination.PAGE_SIZE_OPTIONS}
                            rangeStart={execPagination.start}
                            rangeEnd={execPagination.end}
                            onPageChange={execPagination.handlePageChange}
                            onPageSizeChange={execPagination.handlePageSizeChange}
                            {...paginationToolbarProps}
                        />
                        {renderExecView()}
                    </>
                )
            ) : (
                <p className="pm-hint">Pulsa &quot;Calcular ejecución&quot; para comparar el presupuesto con la ejecución real.</p>
            )}

            <h3 className="acc-h3">Agregar / editar línea de presupuesto</h3>
            <div className="led-form-grid">
                <FilterField label="Cuenta (código PUC)" htmlFor="budget-cuenta" icon="ri-hashtag">
                    <FieldControl id="budget-cuenta" type="text" value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="Ej: 5135" />
                </FilterField>
                <FilterField label="Centro de costo (opcional)" htmlFor="budget-cc" icon="ri-building-line">
                    <FieldControl id="budget-cc" as="select" value={centroCostoId} onChange={(e) => setCentroCostoId(e.target.value)}>
                        <option value="">— Sin centro —</option>
                        {costCenters.map((c) => (
                            <option key={c._id} value={c._id}>{c.codigo} · {c.descripcion}</option>
                        ))}
                    </FieldControl>
                </FilterField>
                <FilterField label="Valor mensual (repartir igual)" htmlFor="budget-mensual" icon="ri-money-dollar-circle-line">
                    <div style={{ display: "flex", gap: 8 }}>
                        <FieldControl
                            id="budget-mensual"
                            type="number"
                            value={valorMensual || ""}
                            onChange={(e) => setValorMensual(Number(e.target.value) || 0)}
                            placeholder="0"
                        />
                        <button type="button" className="btn-secondary" onClick={repartirIgual}>Repartir</button>
                    </div>
                </FilterField>
            </div>

            <div className="led-form-grid">
                {MESES.map((m, i) => (
                    <FilterField key={m} label={m} htmlFor={`budget-mes-${i}`} icon="ri-calendar-2-line">
                        <FieldControl
                            id={`budget-mes-${i}`}
                            type="number"
                            value={meses[i] || ""}
                            onChange={(e) => setMes(i, Number(e.target.value) || 0)}
                            placeholder="0"
                        />
                    </FilterField>
                ))}
            </div>

            <div className="led-form-actions">
                <button type="button" className="btn-primary" onClick={guardar} disabled={saving}>
                    <i className="ri-save-line" aria-hidden /> {saving ? "Guardando..." : "Guardar línea"}
                </button>
                <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
                    <i className="ri-eraser-line" aria-hidden /> Limpiar
                </button>
            </div>

            <h3 className="acc-h3">Líneas de presupuesto — {anio} ({escenario})</h3>
            {loadingLines ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : lines.length === 0 ? (
                <p className="pm-hint">Aún no hay líneas de presupuesto para este año y escenario.</p>
            ) : (
                <>
                    <PaginationToolbar
                        position="top"
                        page={linesPagination.page}
                        totalPages={linesPagination.totalPages}
                        totalItems={linesPagination.totalItems}
                        pageSize={linesPagination.pageSize}
                        pageSizeOptions={linesPagination.PAGE_SIZE_OPTIONS}
                        rangeStart={linesPagination.start}
                        rangeEnd={linesPagination.end}
                        onPageChange={linesPagination.handlePageChange}
                        onPageSizeChange={linesPagination.handlePageSizeChange}
                        {...paginationToolbarProps}
                    />
                    {renderLinesView()}
                </>
            )}
        </div>
    );
};

export default Budget;
