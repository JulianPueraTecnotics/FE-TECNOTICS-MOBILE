import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getCostCenters, createCostCenter, deleteCostCenter, importCostCenters } from "../accounting.service";
import type { CostCenter } from "../accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import {
    FilterField,
    FieldControl,
    useListFiltersPanel,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
} from "../../../components/design-system";
import { downloadTemplateXlsx, downloadTemplateCsv, readSpreadsheet, type ColumnDef } from "../import.utils";

const CC_COLUMNS: ColumnDef[] = [
    { key: "codigo", header: "codigo", sample: "001" },
    { key: "descripcion", header: "descripcion", sample: "Administración" },
];

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "codigo", label: "Código", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "descripcion", label: "Descripción", type: "text", icon: "ri-file-text-line", serverSide: true },
];

const CostCenters: React.FC = () => {
    const [items, setItems] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(true);
    const [codigo, setCodigo] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [filterCodigo, setFilterCodigo] = useState("");
    const [filterDescripcion, setFilterDescripcion] = useState("");
    const [adding, setAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

    const getRowFilterValue = useCallback((row: CostCenter, filterId: string): string => {
        switch (filterId) {
            case "codigo": return row.codigo ?? "";
            case "descripcion": return row.descripcion ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);

    const filteredItems = useMemo(() => {
        const qCod = filterCodigo.trim().toLowerCase();
        const qDesc = filterDescripcion.trim().toLowerCase();
        const base = items.filter((c) => {
            if (qCod && !c.codigo.toLowerCase().includes(qCod)) return false;
            if (qDesc && !(c.descripcion || "").toLowerCase().includes(qDesc)) return false;
            return true;
        });
        return filterRows(base);
    }, [items, filterCodigo, filterDescripcion, filterRows]);

    const hasActiveFilters = filterCodigo.trim() !== "" || filterDescripcion.trim() !== "" || hasActiveClientFilters;

    const clearFilters = () => {
        setFilterCodigo("");
        setFilterDescripcion("");
        clearColFilters();
    };

    const { filtersToolbar, filtersMobileDrawer } = useListFiltersPanel({
        panelId: "cost-centers",
        title: "Filtrar centros de costo",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [filterCodigo, filterDescripcion, colFilterValues],
        filterContent: (
            <>
                <FilterField label="Código" htmlFor="cc-filter-codigo" icon="ri-hashtag">
                    <FieldControl id="cc-filter-codigo" value={filterCodigo} onChange={(e) => setFilterCodigo(e.target.value)} placeholder="Ej. 001" />
                </FilterField>
                <FilterField label="Descripción" htmlFor="cc-filter-descripcion" icon="ri-file-text-line">
                    <FieldControl id="cc-filter-descripcion" value={filterDescripcion} onChange={(e) => setFilterDescripcion(e.target.value)} placeholder="Administración" />
                </FilterField>
                <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
            </>
        ),
    });

    const load = async () => {
        setLoading(true);
        try {
            const res = await getCostCenters();
            setItems(res.cost_centers);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);

    const add = async () => {
        if (!codigo.trim()) {
            errorToast("El código es requerido");
            return;
        }
        setAdding(true);
        try {
            await createCostCenter(codigo.trim(), descripcion.trim());
            successToast("Centro de costo creado");
            setCodigo("");
            setDescripcion("");
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setAdding(false);
        }
    };

    const onImport = async (file: File | null) => {
        if (!file) return;
        setImporting(true);
        try {
            const rows = await readSpreadsheet(file, CC_COLUMNS);
            const valid = rows
                .map((r) => ({ codigo: (r.codigo || "").trim(), descripcion: (r.descripcion || "").trim() }))
                .filter((r) => r.codigo && r.codigo !== "001");
            if (!valid.length) {
                errorToast("No se encontraron centros de costo válidos. Usa la plantilla (columnas: codigo, descripcion).");
                return;
            }
            const res = await importCostCenters(valid);
            successToast(`${res.importados} centro(s) de costo importado(s)`);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al importar");
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const remove = async () => {
        if (!toDelete) return;
        try {
            await deleteCostCenter(toDelete.id);
            successToast("Centro de costo eliminado");
            setToDelete(null);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Centros de costo</h2>
                    <p className="acc-sub">Códigos para imputar los gastos. Crea los que uses, o impórtalos desde Excel/CSV.</p>
                </div>
                <div className="acc-head-actions">
                    <button className="btn-secondary" onClick={() => downloadTemplateXlsx("plantilla-centros-costo.xlsx", CC_COLUMNS)}>
                        <i className="ri-file-excel-2-line" /> Plantilla Excel
                    </button>
                    <button className="btn-secondary" onClick={() => downloadTemplateCsv("plantilla-centros-costo.csv", CC_COLUMNS)}>
                        <i className="ri-file-text-line" /> Plantilla CSV
                    </button>
                    <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
                        <i className="ri-upload-2-line" /> {importing ? "Importando..." : "Importar"}
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onImport(e.target.files?.[0] ?? null)} />
                </div>
            </div>

            <div className="led-form-grid" style={{ alignItems: "end" }}>
                <FilterField label="Código" htmlFor="cc-codigo" icon="ri-hashtag">
                    <FieldControl id="cc-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. 001" />
                </FilterField>
                <FilterField label="Descripción" htmlFor="cc-descripcion" icon="ri-file-text-line">
                    <FieldControl id="cc-descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Administración" />
                </FilterField>
                <div className="acc-actions" style={{ margin: 0 }}><button className="btn-primary" onClick={add} disabled={adding}>Agregar</button></div>
            </div>

            {filtersMobileDrawer}

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : items.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay centros de costo todavía.</p>
            ) : (
                <>
                    <div className="purchases-filters-toolbar" style={{ marginTop: 16, justifyContent: "flex-end" }}>
                        {filtersToolbar}
                    </div>
                    <div className="purchases-table-container ds-table-container" style={{ marginTop: 8 }}>
                    <table className="purchases-table ds-table">
                        <thead><tr><th>Código</th><th>Descripción</th><th></th></tr></thead>
                        <tbody>
                            {filteredItems.map((c) => (
                                <tr key={c._id}>
                                    <td data-label="Código">{c.codigo}</td>
                                    <td data-label="Descripción">{c.descripcion || "—"}</td>
                                    <td style={{ textAlign: "right" }}>
                                        <button className="btn-action" title="Eliminar" onClick={() => setToDelete({ id: c._id, name: c.codigo })}><i className="ri-delete-bin-line" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </>
            )}

            <ConfirmModal isOpen={!!toDelete} title="Eliminar centro de costo" message={`¿Eliminar "${toDelete?.name}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={remove} />
        </div>
    );
};

export default CostCenters;
