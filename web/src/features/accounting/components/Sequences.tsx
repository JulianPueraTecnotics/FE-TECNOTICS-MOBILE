import { useEffect, useState } from "react";
import { getSequence, configureSequence, blockSequenceRange } from "../accounting.service";
import type { AccountingSequence } from "../accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl } from "../../../components/design-system";

type SeqType = "egreso" | "causacion";

const SequenceCard: React.FC<{ type: SeqType; title: string }> = ({ type, title }) => {
    const [seq, setSeq] = useState<AccountingSequence | null>(null);
    const [base, setBase] = useState("");
    const [comprobante, setComprobante] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [motivo, setMotivo] = useState("");
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            const res = await getSequence(type);
            setSeq(res.sequence);
            if (res.sequence) {
                setBase(String(res.sequence.base_number));
                setComprobante(res.sequence.numero_comprobante != null ? String(res.sequence.numero_comprobante) : "");
            }
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const save = async () => {
        if (!base || Number(base) <= 0) {
            errorToast("Indica el número inicial");
            return;
        }
        setBusy(true);
        try {
            const res = await configureSequence(type, Number(base), comprobante ? Number(comprobante) : undefined);
            successToast(res.message);
            setSeq(res.sequence);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusy(false);
        }
    };

    const block = async () => {
        if (!from || !to) {
            errorToast("Indica el rango (desde / hasta)");
            return;
        }
        setBusy(true);
        try {
            const res = await blockSequenceRange(type, { from: Number(from), to: Number(to), motivo });
            successToast("Rango bloqueado");
            setSeq(res.sequence);
            setFrom("");
            setTo("");
            setMotivo("");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusy(false);
        }
    };

    const inUse = seq?.status === "in_use";

    return (
        <div className="acc-card">
            <h2>{title}</h2>
            <p className="acc-sub">Número inicial del comprobante y rangos ya usados en otro sistema (no se reasignan).</p>

            <div className="led-form-grid" style={{ alignItems: "end" }}>
                <FilterField label={`Número inicial${inUse ? " (en uso)" : ""}`} htmlFor={`seq-${type}-base`} icon="ri-hashtag">
                    <FieldControl id={`seq-${type}-base`} type="number" value={base} onChange={(e) => setBase(e.target.value)} disabled={inUse} />
                </FilterField>
                <FilterField label="Número de comprobante (export)" htmlFor={`seq-${type}-comp`} icon="ri-file-list-3-line">
                    <FieldControl id={`seq-${type}-comp`} type="number" value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
                </FilterField>
            </div>
            {seq && <p className="acc-sub">Último asignado: <strong>{seq.current_number}</strong></p>}
            <div className="acc-actions">
                <button className="btn-primary" onClick={save} disabled={busy}>Guardar</button>
            </div>

            <h3 className="acc-h3">Rangos bloqueados</h3>
            <div className="led-form-grid" style={{ alignItems: "end" }}>
                <FilterField label="Desde" htmlFor={`seq-${type}-from`} icon="ri-arrow-right-line">
                    <FieldControl id={`seq-${type}-from`} type="number" value={from} onChange={(e) => setFrom(e.target.value)} />
                </FilterField>
                <FilterField label="Hasta" htmlFor={`seq-${type}-to`} icon="ri-arrow-left-line">
                    <FieldControl id={`seq-${type}-to`} type="number" value={to} onChange={(e) => setTo(e.target.value)} />
                </FilterField>
                <FilterField label="Motivo" htmlFor={`seq-${type}-motivo`} icon="ri-file-text-line">
                    <FieldControl id={`seq-${type}-motivo`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. usados en ERP" />
                </FilterField>
            </div>
            <div className="acc-actions">
                <button className="btn-secondary" onClick={block} disabled={busy}>Bloquear rango</button>
            </div>
            {seq?.blocked_ranges?.length ? (
                <ul className="acc-rangelist">
                    {seq.blocked_ranges.map((r, i) => (
                        <li key={i}>{r.from} – {r.to}{r.motivo ? ` · ${r.motivo}` : ""}</li>
                    ))}
                </ul>
            ) : (
                <p className="acc-sub">Sin rangos bloqueados.</p>
            )}
        </div>
    );
};

const Sequences: React.FC = () => (
    <div className="acc-stack">
        <SequenceCard type="egreso" title="Consecutivo de egreso" />
        <SequenceCard type="causacion" title="Consecutivo de causación" />
    </div>
);

export default Sequences;
