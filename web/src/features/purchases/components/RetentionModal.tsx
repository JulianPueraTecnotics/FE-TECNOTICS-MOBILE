import { useEffect, useState } from "react";
import type { Purchase } from "../purchases.types";
import {
    previewRetention, applyRetention, type RetentionLine,
    previewGroupedRetention, applyGroupedRetention, type RetentionGroup,
} from "../purchases.service";
import { getRetentions } from "../../accounting/accounting.service";
import type { RetentionConcept } from "../../accounting/accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal } from "../../../components/design-system";
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
const CAT_LABEL: Record<string, string> = {
    compras: "Compras", servicios: "Servicios", honorarios: "Honorarios y consultoría",
    arrendamientos: "Arrendamientos", salarios: "Salarios", otros: "Otros", sin_categoria: "Sin categoría",
};

type Mode = "grouped" | "manual";

const RetentionModal: React.FC<Props> = ({ isOpen, purchase, onClose, onApplied }) => {
    const [mode, setMode] = useState<Mode>("grouped");
    const [applying, setApplying] = useState(false);

    // Modo agrupado (por categoría, recomendado).
    const [groups, setGroups] = useState<RetentionGroup[]>([]);
    const [groupedTotal, setGroupedTotal] = useState(0);
    const [loadingGrouped, setLoadingGrouped] = useState(false);

    // Modo manual (selección de conceptos).
    const [concepts, setConcepts] = useState<RetentionConcept[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [preview, setPreview] = useState<RetentionLine[]>([]);
    const [loading, setLoading] = useState(false);

    // Al abrir: cargar el cálculo agrupado y los conceptos para el modo manual.
    useEffect(() => {
        if (!isOpen || !purchase) return;
        setMode("grouped");
        setSelected(new Set());
        setPreview([]);
        setGroups([]);
        setLoadingGrouped(true);
        (async () => {
            try {
                const res = await previewGroupedRetention(purchase._id);
                setGroups(res.groups);
                setGroupedTotal(res.total_retenido);
            } catch (e) {
                errorToast(e instanceof Error ? e.message : "Error al calcular la retención por categoría");
            } finally {
                setLoadingGrouped(false);
            }
            try {
                const res = await getRetentions();
                setConcepts(res.concepts.filter((c) => c.active && c.cuenta));
            } catch { /* opcional para el modo manual */ }
        })();
    }, [isOpen, purchase]);

    // Modo manual: recalcular preview al cambiar la selección.
    useEffect(() => {
        if (!isOpen || !purchase || mode !== "manual" || selected.size === 0) { setPreview([]); return; }
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
    }, [selected, isOpen, purchase, mode]);

    if (!isOpen || !purchase) return null;

    const toggle = (id: string) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const manualTotal = preview.reduce((s, l) => s + l.valor, 0);
    const total = mode === "grouped" ? groupedTotal : manualTotal;

    const apply = async () => {
        setApplying(true);
        try {
            const res = mode === "grouped"
                ? await applyGroupedRetention(purchase._id)
                : await applyRetention(purchase._id, [...selected]);
            successToast(res.message);
            onApplied();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo aplicar");
        } finally {
            setApplying(false);
        }
    };

    return (
        <AppModal
            wide
            title={`Retefuente — ${purchase.prefix}${purchase.number}`}
            onClose={onClose}
            closeDisabled={applying}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={applying}>Cancelar</button>
                    <button type="button" className="export-submit" onClick={apply} disabled={applying || total <= 0}>{applying ? "Aplicando..." : "Aplicar y contabilizar"}</button>
                </>
            }
        >
                    <p className="pm-hint">
                        Proveedor: <strong>{purchase.supplier_name}</strong> · Total factura: <strong>{money(purchase.total)}</strong>.
                        La retefuente se calcula <strong>por factura</strong>: se agrupan los ítems por categoría, se suman y se compara la suma contra el tope (base mínima en UVT).
                    </p>

                    {/* Selector de modo */}
                    <div className="pm-tabs" style={{ display: "flex", gap: 8, margin: "8px 0 12px" }}>
                        <button type="button" className={mode === "grouped" ? "btn-primary" : "btn-secondary btn-secondary--outline"} onClick={() => setMode("grouped")}>Por categoría (automático)</button>
                        <button type="button" className={mode === "manual" ? "btn-primary" : "btn-secondary btn-secondary--outline"} onClick={() => setMode("manual")}>Manual por concepto</button>
                    </div>

                    {mode === "grouped" ? (
                        loadingGrouped ? (
                            <p className="pm-hint">Calculando retención agrupada…</p>
                        ) : groups.length === 0 ? (
                            <p className="pm-hint">No hay ítems con base para retener. Parametriza la <strong>categoría de retención</strong> de los productos (Parametrización).</p>
                        ) : (
                            <table className="acc-table" style={{ marginTop: 4 }}>
                                <thead><tr><th>Categoría</th><th style={{ textAlign: "right" }}>Base agrupada</th><th>Concepto</th><th>Tarifa</th><th style={{ textAlign: "right" }}>Tope</th><th style={{ textAlign: "right" }}>Retención</th></tr></thead>
                                <tbody>
                                    {groups.map((g) => (
                                        <tr key={g.categoria} title={g.items.map((i) => `${i.descripcion}: ${money(i.base)}`).join("\n")}>
                                            <td><strong>{CAT_LABEL[g.categoria] ?? g.categoria}</strong><br /><span style={{ color: "var(--text-muted)", fontSize: ".78rem" }}>{g.items.length} ítem(s)</span></td>
                                            <td style={{ textAlign: "right" }}>{money(g.base)}</td>
                                            <td style={{ fontSize: ".82rem" }}>{g.descripcion ?? (g.tarifa > 0 ? "—" : "sin concepto")}</td>
                                            <td>{g.tarifa ? `${g.tarifa}%` : "—"}</td>
                                            <td style={{ textAlign: "right" }}>{g.base_minima ? money(g.base_minima) : "—"}</td>
                                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                                                {g.aplica ? money(g.valor) : <span style={{ color: "var(--text-muted)" }}>{g.tarifa ? "bajo el tope" : "n/a"}</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        concepts.length === 0 ? (
                            <p className="pm-hint">No hay conceptos de retención con cuenta configurada. Créalos en Configuración › Impuestos.</p>
                        ) : (
                            <table className="acc-table" style={{ marginTop: 4 }}>
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
                        )
                    )}

                    <div className="led-balance ok" style={{ marginTop: 14 }}>
                        Total a retener: <strong style={{ marginLeft: 6 }}>{money(total)}</strong> · CxP neta: <strong style={{ marginLeft: 6 }}>{money(purchase.total - total)}</strong>
                    </div>
                    <p className="pm-hint">Al aplicar, se recontabiliza el comprobante de causación reduciendo la cuenta por pagar.</p>
        </AppModal>
    );
};

export default RetentionModal;
