import { useEffect, useMemo, useState } from "react";
import { getCoa } from "../../accounting/accounting.service";
import type { CoaAccount } from "../../accounting/accounting.types";
import { createEntry, updateEntry, getEntry } from "../ledger.service";
import { JOURNAL_TYPE_LABELS, type JournalType, type ManualLineInput } from "../ledger.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

interface Props {
    entryId?: string | null; // si viene, edita
    onClose: () => void;
    onSaved: () => void;
}

interface EditLine extends ManualLineInput {
    _k: number;
}

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

let counter = 1;
const blankLine = (): EditLine => ({ _k: counter++, cuenta: "", debito: 0, credito: 0, descripcion: "" });

const TYPES: JournalType[] = ["NC", "CC", "CE", "RC", "FV", "DEP"];

const EntryEditor: React.FC<Props> = ({ entryId, onClose, onSaved }) => {
    const [tipo, setTipo] = useState<JournalType>("NC");
    const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10));
    const [descripcion, setDescripcion] = useState("");
    const [lines, setLines] = useState<EditLine[]>([blankLine(), blankLine()]);
    const [accounts, setAccounts] = useState<CoaAccount[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!entryId);

    useEffect(() => {
        // Cargamos cuentas del PUC para el autocompletar (las primeras 200).
        (async () => {
            try {
                const res = await getCoa(1, 200, "");
                setAccounts(res.accounts);
            } catch {
                /* sin catálogo igual se puede teclear el código */
            }
        })();
    }, []);

    useEffect(() => {
        if (!entryId) return;
        (async () => {
            try {
                const { entry } = await getEntry(entryId);
                setTipo(entry.tipo);
                setFecha(new Date(entry.fecha).toISOString().slice(0, 10));
                setDescripcion(entry.descripcion);
                setLines((entry.lineas ?? []).map((l) => ({ _k: counter++, cuenta: l.cuenta, debito: l.debito, credito: l.credito, descripcion: l.descripcion })));
            } catch (e) {
                errorToast(e instanceof Error ? e.message : "No se pudo cargar el comprobante");
            } finally {
                setLoading(false);
            }
        })();
    }, [entryId]);

    const totals = useMemo(() => {
        const d = round2(lines.reduce((a, l) => a + (Number(l.debito) || 0), 0));
        const c = round2(lines.reduce((a, l) => a + (Number(l.credito) || 0), 0));
        return { d, c, diff: round2(d - c) };
    }, [lines]);

    const balanced = totals.diff === 0 && totals.d > 0;

    const setLine = (k: number, patch: Partial<EditLine>) => setLines((prev) => prev.map((l) => (l._k === k ? { ...l, ...patch } : l)));
    const addLine = () => setLines((prev) => [...prev, blankLine()]);
    const removeLine = (k: number) => setLines((prev) => (prev.length > 2 ? prev.filter((l) => l._k !== k) : prev));

    const accName = (codigo: string) => accounts.find((a) => a.codigo === codigo)?.nombre ?? "";

    const save = async () => {
        if (!balanced) {
            errorToast("El comprobante debe cuadrar (débitos = créditos) y ser mayor a cero");
            return;
        }
        const payload = {
            tipo,
            fecha,
            descripcion,
            lineas: lines
                .filter((l) => l.cuenta.trim() && ((Number(l.debito) || 0) > 0 || (Number(l.credito) || 0) > 0))
                .map((l) => ({ cuenta: l.cuenta.trim(), debito: Number(l.debito) || 0, credito: Number(l.credito) || 0, descripcion: l.descripcion })),
        };
        if (payload.lineas.length < 2) {
            errorToast("Agrega al menos dos líneas con cuenta y valor");
            return;
        }
        setSaving(true);
        try {
            if (entryId) await updateEntry(entryId, payload);
            else await createEntry(payload);
            successToast(entryId ? "Comprobante actualizado" : "Comprobante creado");
            onSaved();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>;

    return (
        <div className="led-editor">
            <div className="led-editor__head">
                <h2>{entryId ? "Editar comprobante" : "Nuevo comprobante"}</h2>
                <button className="btn-secondary" onClick={onClose}><i className="ri-arrow-left-line" /> Volver</button>
            </div>

            <div className="led-editor__meta">
                <div className="acc-field"><label>Tipo</label>
                    <select value={tipo} onChange={(e) => setTipo(e.target.value as JournalType)}>
                        {TYPES.map((t) => <option key={t} value={t}>{JOURNAL_TYPE_LABELS[t]} ({t})</option>)}
                    </select>
                </div>
                <div className="acc-field"><label>Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
                <div className="acc-field" style={{ flex: 1 }}><label>Descripción</label><input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Concepto del comprobante" /></div>
            </div>

            <table className="led-grid">
                <thead>
                    <tr><th style={{ width: "16%" }}>Cuenta</th><th>Nombre</th><th style={{ width: "18%" }}>Descripción</th><th style={{ width: "14%" }}>Débito</th><th style={{ width: "14%" }}>Crédito</th><th style={{ width: 40 }}></th></tr>
                </thead>
                <tbody>
                    {lines.map((l) => (
                        <tr key={l._k}>
                            <td>
                                <input list="led-coa" value={l.cuenta} onChange={(e) => setLine(l._k, { cuenta: e.target.value })} placeholder="Código" />
                            </td>
                            <td className="led-grid__name">{accName(l.cuenta) || "—"}</td>
                            <td><input value={l.descripcion ?? ""} onChange={(e) => setLine(l._k, { descripcion: e.target.value })} /></td>
                            <td><input type="number" min={0} value={l.debito || ""} onChange={(e) => setLine(l._k, { debito: Number(e.target.value) || 0, credito: 0 })} /></td>
                            <td><input type="number" min={0} value={l.credito || ""} onChange={(e) => setLine(l._k, { credito: Number(e.target.value) || 0, debito: 0 })} /></td>
                            <td><button className="btn-icon" title="Quitar" onClick={() => removeLine(l._k)} disabled={lines.length <= 2}><i className="ri-close-line" /></button></td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={3}><button className="btn-secondary" onClick={addLine}><i className="ri-add-line" /> Agregar línea</button></td>
                        <td className="led-total">{money(totals.d)}</td>
                        <td className="led-total">{money(totals.c)}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <datalist id="led-coa">
                {accounts.map((a) => <option key={a._id} value={a.codigo}>{a.codigo} — {a.nombre}</option>)}
            </datalist>

            <div className="led-editor__foot">
                <div className={`led-balance ${balanced ? "ok" : "bad"}`}>
                    {balanced ? (
                        <><i className="ri-checkbox-circle-line" /> Cuadra</>
                    ) : (
                        <><i className="ri-error-warning-line" /> Diferencia: {money(totals.diff)}</>
                    )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button className="btn-primary" onClick={save} disabled={saving || !balanced}>{saving ? "Guardando..." : "Guardar borrador"}</button>
                </div>
            </div>
        </div>
    );
};

export default EntryEditor;
