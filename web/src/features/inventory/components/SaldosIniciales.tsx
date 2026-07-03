import { useEffect, useMemo, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getWarehouses, cargarSaldosIniciales } from "../inventory.service";
import type { Warehouse, SaldoInicialRow, SaldosInicialesResultado } from "../inventory.types";
import type { ItemData } from "../../../types";
import ItemPicker from "./ItemPicker";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    paginationRange,
    FieldControl,
    FieldInput,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { normalizePageSize, PAGE_SIZE_OPTIONS, todayIso } from "../inventoryFormat";

interface DraftRow {
    key: string;
    item: ItemData | null;
    warehouse_id: string;
    cantidad: string;
    costo_unitario: string;
    fecha: string;
}

const newRow = (): DraftRow => ({
    key: crypto.randomUUID(),
    item: null,
    warehouse_id: "",
    cantidad: "",
    costo_unitario: "",
    fecha: todayIso(),
});

const SaldosIniciales: React.FC = () => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [rows, setRows] = useState<DraftRow[]>([newRow()]);
    const [saving, setSaving] = useState(false);
    const [results, setResults] = useState<SaldosInicialesResultado[] | null>(null);
    const [resultsPage, setResultsPage] = useState(1);
    const [resultsPageSize, setResultsPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    useEffect(() => {
        getWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
    }, []);

    const patch = (key: string, p: Partial<DraftRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
    const addRow = () => setRows((rs) => [...rs, newRow()]);
    const removeRow = (key: string) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));

    const submit = async () => {
        const payload: SaldoInicialRow[] = [];
        for (const r of rows) {
            if (!r.item?._id) continue;
            const cant = Number(r.cantidad);
            const costo = Number(r.costo_unitario);
            if (!r.warehouse_id) {
                errorToast("Cada fila con ítem debe tener bodega");
                return;
            }
            if (!cant || cant <= 0) {
                errorToast("Cada fila debe tener una cantidad mayor a cero");
                return;
            }
            if (!costo || costo < 0) {
                errorToast("Cada fila debe tener un costo unitario válido");
                return;
            }
            payload.push({
                item_id: r.item._id,
                warehouse_id: r.warehouse_id,
                cantidad: cant,
                costo_unitario: costo,
                fecha: r.fecha || undefined,
            });
        }
        if (payload.length === 0) {
            errorToast("Agrega al menos una fila con producto, bodega, cantidad y costo");
            return;
        }
        setSaving(true);
        setResults(null);
        try {
            const res = await cargarSaldosIniciales(payload);
            setResults(res.resultados ?? []);
            setResultsPage(1);
            successToast(`${res.importados} saldo(s) inicial(es) cargado(s)`);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSaving(false);
        }
    };

    const resultItems = results ?? [];
    const totalItems = resultItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / resultsPageSize));
    const safePage = Math.min(resultsPage, totalPages);
    const paginatedResults = useMemo(() => {
        const start = (safePage - 1) * resultsPageSize;
        return resultItems.slice(start, start + resultsPageSize);
    }, [resultItems, safePage, resultsPageSize]);
    const { start, end } = paginationRange(safePage, resultsPageSize, totalItems);

    const didMountResultsPageSize = useRef(false);
    useEffect(() => {
        if (!didMountResultsPageSize.current) {
            didMountResultsPageSize.current = true;
            return;
        }
        setResultsPage(1);
    }, [resultsPageSize]);

    useEffect(() => {
        if (resultsPage > totalPages) setResultsPage(totalPages);
    }, [resultsPage, totalPages]);

    const handleResultsPageChange = (next: number) => setResultsPage(Math.max(1, Math.min(totalPages, next)));
    const handleResultsPageSizeChange = (next: number) => {
        setResultsPageSize(normalizePageSize(next));
        setResultsPage(1);
    };

    const renderResultBadge = (ok: boolean) => (
        <span className={`status-badge ${ok ? "status-paid" : "status-rejected"}`}>{ok ? "OK" : "Error"}</span>
    );

    const renderResultsTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Ítem</th>
                        <th>Resultado</th>
                        <th>Detalle</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedResults.map((res, i) => (
                        <tr key={`${res.item_id}-${i}`}>
                            <td data-label="Ítem">{res.item_id}</td>
                            <td data-label="Resultado">{renderResultBadge(res.ok)}</td>
                            <td data-label="Detalle">{res.message || (res.ok ? "Cargado" : "—")}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderResultsList = () => (
        <div className="purchases-list-view">
            {paginatedResults.map((res, i) => (
                <article key={`${res.item_id}-${i}`} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{res.item_id}</strong>
                            {renderResultBadge(res.ok)}
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Detalle</dt>
                                <dd>{res.message || (res.ok ? "Cargado" : "—")}</dd>
                            </div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderResultsCards = () => (
        <div className="purchases-cards-view">
            {paginatedResults.map((res, i) => (
                <article key={`${res.item_id}-${i}`} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{res.item_id}</strong>
                        {renderResultBadge(res.ok)}
                    </div>
                    <dl className="purchases-card__fields">
                        <div className="purchases-card__field">
                            <dt>Detalle</dt>
                            <dd>{res.message || (res.ok ? "Cargado" : "—")}</dd>
                        </div>
                    </dl>
                </article>
            ))}
        </div>
    );

    const renderResultsView = () => {
        if (effectiveViewMode === "list") return renderResultsList();
        if (effectiveViewMode === "cards") return renderResultsCards();
        return renderResultsTable();
    };

    return (
        <div className="inv-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Carga las existencias y el costo de arranque del inventario por ítem y bodega. Agrega varias filas y envíalas en lote.
            </p>

            <div className="inv-section__toolbar">
                <button type="button" className="btn-secondary" onClick={addRow} disabled={saving}>
                    <i className="ri-add-line" aria-hidden /> Agregar fila
                </button>
            </div>

            <div className="purchases-table-container ds-table-container inv-editable-table">
                <table className="purchases-table ds-table">
                    <thead>
                        <tr>
                            <th style={{ minWidth: 220 }}>Producto</th>
                            <th>Bodega</th>
                            <th className="ds-num">Cantidad</th>
                            <th className="ds-num">Costo unitario</th>
                            <th>Fecha</th>
                            <th aria-label="Acciones" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.key}>
                                <td data-label="Producto">
                                    <FieldInput icon="ri-box-3-line">
                                        <ItemPicker
                                            embedded
                                            value={r.item}
                                            onChange={(it) => patch(r.key, { item: it })}
                                        />
                                    </FieldInput>
                                </td>
                                <td data-label="Bodega">
                                    <FieldInput icon="ri-building-line">
                                        <FieldControl
                                            as="select"
                                            value={r.warehouse_id}
                                            onChange={(e) => patch(r.key, { warehouse_id: e.target.value })}
                                            disabled={saving}
                                        >
                                            <option value="">Selecciona…</option>
                                            {warehouses.map((w) => (
                                                <option key={w._id} value={w._id}>
                                                    {w.codigo} · {w.nombre}
                                                </option>
                                            ))}
                                        </FieldControl>
                                    </FieldInput>
                                </td>
                                <td data-label="Cantidad" className="ds-num">
                                    <FieldInput icon="ri-scales-3-line">
                                        <FieldControl
                                            type="number"
                                            value={r.cantidad}
                                            onChange={(e) => patch(r.key, { cantidad: e.target.value })}
                                            placeholder="Ej. 10"
                                            disabled={saving}
                                        />
                                    </FieldInput>
                                </td>
                                <td data-label="Costo unitario" className="ds-num">
                                    <FieldInput icon="ri-money-dollar-circle-line">
                                        <FieldControl
                                            type="number"
                                            value={r.costo_unitario}
                                            onChange={(e) => patch(r.key, { costo_unitario: e.target.value })}
                                            placeholder="Ej. 15000"
                                            disabled={saving}
                                        />
                                    </FieldInput>
                                </td>
                                <td data-label="Fecha">
                                    <FieldInput icon="ri-calendar-line">
                                        <FieldControl
                                            type="date"
                                            value={r.fecha}
                                            onChange={(e) => patch(r.key, { fecha: e.target.value })}
                                            disabled={saving}
                                        />
                                    </FieldInput>
                                </td>
                                <td data-label="">
                                    <button
                                        type="button"
                                        className="btn-action"
                                        title="Quitar fila"
                                        onClick={() => removeRow(r.key)}
                                        disabled={rows.length === 1 || saving}
                                    >
                                        <i className="ri-delete-bin-line" aria-hidden />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="inv-form-actions">
                <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
                    {saving ? (
                        <>
                            <i className="ri-loader-4-line rotating" aria-hidden /> Cargando…
                        </>
                    ) : (
                        <>
                            <i className="ri-upload-line" aria-hidden /> Cargar saldos iniciales
                        </>
                    )}
                </button>
            </div>

            {results && results.length > 0 && (
                <div className="inv-results-block">
                    <h3 className="inv-results-block__title">Resultados</h3>
                    <PaginationToolbar
                        position="top"
                        page={safePage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={resultsPageSize}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                        rangeStart={start}
                        rangeEnd={end}
                        onPageChange={handleResultsPageChange}
                        onPageSizeChange={handleResultsPageSizeChange}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        showViewToggle
                        emptyLabel={totalItems === 0 ? "Sin resultados" : undefined}
                    />
                    {renderResultsView()}
                    <PaginationToolbar
                        position="bottom"
                        page={safePage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={resultsPageSize}
                        rangeStart={start}
                        rangeEnd={end}
                        onPageChange={handleResultsPageChange}
                        emptyLabel={totalItems === 0 ? "Sin resultados" : undefined}
                    />
                </div>
            )}
        </div>
    );
};

export default SaldosIniciales;
