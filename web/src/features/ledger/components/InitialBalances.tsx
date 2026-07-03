import { useEffect, useMemo, useRef, useState } from "react";
import { getCoa } from "../../accounting/accounting.service";
import type { CoaAccount } from "../../accounting/accounting.types";
import { downloadRowsXlsx, downloadRowsCsv, readSpreadsheet, type ColumnDef } from "../../accounting/import.utils";
import { getOpeningStatus, createOpening, type OpeningLine } from "../ledger.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl, FieldInput } from "../../../components/design-system";
import { formatAmount } from "../ledgerFormat";

const IbInput: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
    <FieldInput icon={icon}>{children}</FieldInput>
);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const lastYearEnd = () => `${new Date().getFullYear() - 1}-12-31`;

const COLS: ColumnDef[] = [
    { key: "cuenta", header: "cuenta", sample: "13050501" },
    { key: "tercero", header: "tercero", sample: "Cliente XYZ SAS" },
    { key: "referencia", header: "referencia", sample: "FAC-100" },
    { key: "debito", header: "debito", sample: "500000" },
    { key: "credito", header: "credito", sample: "0" },
];

let k = 1;
interface Row extends OpeningLine {
    _k: number;
    tercero_nombre?: string;
}
const blank = (): Row => ({ _k: k++, cuenta: "", tercero_nombre: "", referencia: "", debito: 0, credito: 0 });

const InitialBalances: React.FC = () => {
    const [exists, setExists] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fecha, setFecha] = useState(lastYearEnd());
    const [rows, setRows] = useState<Row[]>([blank(), blank()]);
    const [accounts, setAccounts] = useState<CoaAccount[]>([]);
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        (async () => {
            try {
                const [st, coa] = await Promise.all([getOpeningStatus(), getCoa(1, 200, "")]);
                setExists(st.exists);
                setAccounts(coa.accounts);
            } catch (e) {
                errorToast(e instanceof Error ? e.message : "Error");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const totals = useMemo(() => {
        const d = round2(rows.reduce((a, r) => a + (Number(r.debito) || 0), 0));
        const c = round2(rows.reduce((a, r) => a + (Number(r.credito) || 0), 0));
        return { d, c, diff: round2(d - c) };
    }, [rows]);
    const balanced = totals.diff === 0 && totals.d > 0;

    const set = (key: number, patch: Partial<Row>) => setRows((p) => p.map((r) => (r._k === key ? { ...r, ...patch } : r)));
    const addRow = () => setRows((p) => [...p, blank()]);
    const removeRow = (key: number) => setRows((p) => (p.length > 2 ? p.filter((r) => r._k !== key) : p));
    const accName = (c: string) => accounts.find((a) => a.codigo === c)?.nombre ?? "";

    const downloadTemplate = (kind: "xlsx" | "csv") => {
        const headers = COLS.map((c) => c.header);
        const guide = [COLS.map((c) => c.sample ?? "")];
        if (kind === "xlsx") downloadRowsXlsx("plantilla-saldos-iniciales.xlsx", headers, guide);
        else downloadRowsCsv("plantilla-saldos-iniciales.csv", headers, guide);
    };

    const onImport = async (file: File | null) => {
        if (!file) return;
        try {
            const raw = await readSpreadsheet(file, COLS);
            const imported: Row[] = raw
                .filter((r) => (r.cuenta || "").trim() && r.cuenta !== "13050501")
                .map((r) => ({
                    _k: k++,
                    cuenta: r.cuenta.trim(),
                    tercero_nombre: r.tercero || "",
                    referencia: r.referencia || "",
                    debito: Number(r.debito) || 0,
                    credito: Number(r.credito) || 0,
                }));
            if (!imported.length) {
                errorToast("No se encontraron filas válidas (columnas: cuenta, tercero, referencia, debito, credito)");
                return;
            }
            setRows(imported);
            successToast(`${imported.length} fila(s) cargadas. Revisa el cuadre y confirma.`);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al importar");
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const save = async () => {
        if (!balanced) {
            errorToast("Los saldos iniciales deben cuadrar (débitos = créditos)");
            return;
        }
        const lineas: OpeningLine[] = rows
            .filter((r) => r.cuenta.trim() && ((Number(r.debito) || 0) > 0 || (Number(r.credito) || 0) > 0))
            .map((r) => ({
                cuenta: r.cuenta.trim(),
                tercero_nombre: r.tercero_nombre || undefined,
                referencia: r.referencia || undefined,
                debito: Number(r.debito) || 0,
                credito: Number(r.credito) || 0,
            }));
        setSaving(true);
        try {
            const res = await createOpening({ fecha, descripcion: `Saldos iniciales — corte ${fecha}`, lineas });
            successToast(res.message);
            setExists(true);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>;

    if (exists) {
        return (
            <div className="led-section">
                <p className="pm-hint">
                    Ya hay saldos iniciales cargados (comprobante de apertura). Para corregirlos, anula el comprobante de apertura desde Comprobantes (genera un reverso) y vuelve a cargar.
                </p>
                <div className="led-balance ok">
                    <i className="ri-checkbox-circle-line" aria-hidden /> Apertura registrada
                </div>
            </div>
        );
    }

    return (
        <div className="led-section">
            <p className="pm-hint">
                Carga la posición de apertura. CxC/CxP van por documento (una fila por factura, con su tercero). Debe cuadrar.
            </p>

            <div className="led-section__toolbar led-section__toolbar--actions">
                <button type="button" className="btn-secondary" onClick={() => downloadTemplate("xlsx")}>
                    <i className="ri-file-excel-2-line" aria-hidden /> Plantilla Excel
                </button>
                <button type="button" className="btn-secondary" onClick={() => downloadTemplate("csv")}>
                    <i className="ri-file-text-line" aria-hidden /> Plantilla CSV
                </button>
                <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
                    <i className="ri-upload-2-line" aria-hidden /> Importar
                </button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onImport(e.target.files?.[0] ?? null)} />
            </div>

            <div className="led-section__toolbar">
                <FilterField label="Fecha de corte (último día del ejercicio anterior)" htmlFor="ib-fecha" icon="ri-calendar-line">
                    <FieldControl id="ib-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </FilterField>
            </div>

            <div className="purchases-table-container ds-table-container led-editable-table led-adj-table">
                <table className="purchases-table ds-table">
                    <thead>
                        <tr>
                            <th>Cuenta</th>
                            <th>Nombre</th>
                            <th>Tercero (CxC/CxP)</th>
                            <th>Doc.</th>
                            <th className="ds-num">Débito</th>
                            <th className="ds-num">Crédito</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r._k}>
                                <td data-label="Cuenta">
                                    <IbInput icon="ri-book-2-line">
                                        <FieldControl list="ib-coa" value={r.cuenta} onChange={(e) => set(r._k, { cuenta: e.target.value })} placeholder="Código" title={accName(r.cuenta)} />
                                    </IbInput>
                                </td>
                                <td data-label="Nombre" className="led-grid__name led-adj-readonly">{accName(r.cuenta) || "—"}</td>
                                <td data-label="Tercero (CxC/CxP)">
                                    <IbInput icon="ri-group-line">
                                        <FieldControl value={r.tercero_nombre ?? ""} onChange={(e) => set(r._k, { tercero_nombre: e.target.value })} placeholder="Nombre tercero" />
                                    </IbInput>
                                </td>
                                <td data-label="Doc.">
                                    <IbInput icon="ri-file-list-3-line">
                                        <FieldControl value={r.referencia ?? ""} onChange={(e) => set(r._k, { referencia: e.target.value })} placeholder="Nº doc" />
                                    </IbInput>
                                </td>
                                <td data-label="Débito" className="ds-num">
                                    <IbInput icon="ri-arrow-left-down-line">
                                        <FieldControl type="number" min={0} value={r.debito || ""} onChange={(e) => set(r._k, { debito: Number(e.target.value) || 0, credito: 0 })} />
                                    </IbInput>
                                </td>
                                <td data-label="Crédito" className="ds-num">
                                    <IbInput icon="ri-arrow-right-up-line">
                                        <FieldControl type="number" min={0} value={r.credito || ""} onChange={(e) => set(r._k, { credito: Number(e.target.value) || 0, debito: 0 })} />
                                    </IbInput>
                                </td>
                                <td data-label="">
                                    <button type="button" className="btn-action" aria-label="Quitar fila" onClick={() => removeRow(r._k)} disabled={rows.length <= 2}>
                                        <i className="ri-close-line" aria-hidden />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={4}>
                                <button type="button" className="btn-secondary" onClick={addRow}>
                                    <i className="ri-add-line" aria-hidden /> Agregar fila
                                </button>
                            </td>
                            <td className="led-total ds-num" data-label="Total débito">{formatAmount(totals.d)}</td>
                            <td className="led-total ds-num" data-label="Total crédito">{formatAmount(totals.c)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <datalist id="ib-coa">
                {accounts.map((a) => (
                    <option key={a._id} value={a.codigo}>
                        {a.codigo} — {a.nombre}
                    </option>
                ))}
            </datalist>

            <div className="led-form-actions led-form-actions--end led-form-actions--adj">
                <div className={`led-balance ${balanced ? "ok" : "bad"}`}>
                    {balanced ? (
                        <>
                            <i className="ri-checkbox-circle-line" aria-hidden /> Cuadra
                        </>
                    ) : (
                        <>
                            <i className="ri-error-warning-line" aria-hidden /> Diferencia: {formatAmount(totals.diff)}
                        </>
                    )}
                </div>
                <button type="button" className="btn-primary" onClick={save} disabled={saving || !balanced}>
                    {saving ? "Guardando..." : "Confirmar saldos iniciales"}
                </button>
            </div>
        </div>
    );
};

export default InitialBalances;
