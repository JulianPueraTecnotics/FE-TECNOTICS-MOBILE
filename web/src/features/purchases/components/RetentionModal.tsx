import { useEffect, useState } from "react";
import type { Purchase } from "../purchases.types";
import { previewRetention, applyRetention, type RetentionLine } from "../purchases.service";
import { getRetentions } from "../../accounting/accounting.service";
import type { RetentionConcept } from "../../accounting/accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import "./PurchaseModals.css";
import "../../accounting/page/Configuration.css";
import "../../ledger/page/Accounting.css";

interface Props {
    isOpen: boolean;
    purchase: Purchase | null;
    onClose: () => void;
    onApplied: () => void;
}

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });

const RetentionModal: React.FC<Props> = ({ isOpen, purchase, onClose, onApplied }) => {
    const [concepts, setConcepts] = useState<RetentionConcept[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [preview, setPreview] = useState<RetentionLine[]>([]);
    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setSelected(new Set());
        setPreview([]);
        (async () => {
            try {
                const res = await getRetentions();
                setConcepts(res.concepts.filter((c) => c.active && c.cuenta));
            } catch (e) {
                errorToast(e instanceof Error ? e.message : "Error al cargar conceptos");
            }
        })();
    }, [isOpen]);

    // Recalcula el preview cuando cambia la selección.
    useEffect(() => {
        if (!isOpen || !purchase || selected.size === 0) {
            setPreview([]);
            return;
        }
        let ignore = false;
        setLoading(true);
        (async () => {
            try {
                const res = await previewRetention(purchase._id, [...selected]);
                if (!ignore) setPreview(res.lines);
            } catch (e) {
                if (!ignore) errorToast(e instanceof Error ? e.message : "Error al calcular");
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [selected, isOpen, purchase]);

    if (!isOpen || !purchase) return null;

    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const totalRet = preview.reduce((s, l) => s + l.valor, 0);

    const apply = async () => {
        if (!selected.size) { errorToast("Selecciona al menos un concepto"); return; }
        setApplying(true);
        try {
            const res = await applyRetention(purchase._id, [...selected]);
            successToast(res.message);
            onApplied();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo aplicar");
        } finally {
            setApplying(false);
        }
    };

    return (
        <div className="pm-overlay" onClick={() => !applying && onClose()} role="presentation">
            <div className="pm-modal pm-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="pm-header">
                    <h3>Retenciones — {purchase.prefix}{purchase.number}</h3>
                    <button className="pm-close" onClick={onClose} disabled={applying}><i className="ri-close-line" /></button>
                </div>
                <div className="pm-body">
                    <p className="pm-hint">Proveedor: <strong>{purchase.supplier_name}</strong> · Base (subtotal): <strong>{money(purchase.subtotal)}</strong>. Se aplica cada concepto solo si la base supera su mínimo en UVT.</p>

                    {concepts.length === 0 ? (
                        <p className="pm-hint">No hay conceptos de retención con cuenta configurada. Créalos en Configuración › Impuestos.</p>
                    ) : (
                        <table className="acc-table" style={{ marginTop: 8 }}>
                            <thead><tr><th></th><th>Concepto</th><th>Tarifa</th><th style={{ textAlign: "right" }}>Base mín.</th><th style={{ textAlign: "right" }}>Retención</th></tr></thead>
                            <tbody>
                                {concepts.map((c) => {
                                    const line = preview.find((l) => l.concepto_id === c._id);
                                    return (
                                        <tr key={c._id}>
                                            <td><input type="checkbox" checked={selected.has(c._id)} onChange={() => toggle(c._id)} /></td>
                                            <td>{c.descripcion || c.codigo} <span style={{ color: "var(--text-muted)", fontSize: ".8rem" }}>({c.tipo})</span></td>
                                            <td>{c.tarifa}%</td>
                                            <td style={{ textAlign: "right" }}>{line ? money(line.base_minima) : "—"}</td>
                                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                                                {!selected.has(c._id) ? "—" : loading ? "…" : line?.aplica ? money(line.valor) : <span style={{ color: "var(--text-muted)" }}>bajo mínimo</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    <div className="led-balance ok" style={{ marginTop: 14 }}>
                        Total a retener: <strong style={{ marginLeft: 6 }}>{money(totalRet)}</strong> · CxP neta: <strong style={{ marginLeft: 6 }}>{money(purchase.total - totalRet)}</strong>
                    </div>
                    <p className="pm-hint">Al aplicar, se recontabiliza el comprobante de causación reduciendo la cuenta por pagar.</p>
                </div>
                <div className="pm-actions">
                    <button className="pm-cancel" onClick={onClose} disabled={applying}>Cancelar</button>
                    <button className="pm-submit" onClick={apply} disabled={applying || totalRet <= 0}>{applying ? "Aplicando..." : "Aplicar y contabilizar"}</button>
                </div>
            </div>
        </div>
    );
};

export default RetentionModal;
