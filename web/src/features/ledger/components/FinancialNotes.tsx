import { useCallback, useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getNotes, upsertNote, seedNotes, deleteNote, type FinancialNote } from "../budget.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl, useConfirm } from "../../../components/design-system";
import { thisYear } from "../ledgerFormat";

type DraftNote = {
    _id?: string;
    key: string;
    numero: number;
    titulo: string;
    contenido: string;
    orden: number;
};

const toDraft = (n: FinancialNote): DraftNote => ({
    _id: n._id,
    key: n._id,
    numero: n.numero,
    titulo: n.titulo,
    contenido: n.contenido,
    orden: n.orden,
});

const FinancialNotes: React.FC = () => {
    const { confirm } = useConfirm();
    const [corte, setCorte] = useState(String(thisYear()));
    const [notes, setNotes] = useState<DraftNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [tmpSeq, setTmpSeq] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getNotes(corte.trim());
            setNotes(data.map(toDraft));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar las notas");
        } finally {
            setLoading(false);
        }
    }, [corte]);

    useEffect(() => {
        load();
    }, [load]);

    const setField = (key: string, field: "titulo" | "contenido", value: string) => {
        setNotes((prev) => prev.map((n) => (n.key === key ? { ...n, [field]: value } : n)));
    };

    const nuevaNota = () => {
        const k = `nueva-${tmpSeq}`;
        setTmpSeq((s) => s + 1);
        const maxNum = notes.reduce((m, n) => Math.max(m, n.numero || 0), 0);
        const maxOrden = notes.reduce((m, n) => Math.max(m, n.orden || 0), 0);
        setNotes((prev) => [...prev, { key: k, numero: maxNum + 1, titulo: "", contenido: "", orden: maxOrden + 1 }]);
    };

    const guardar = async (note: DraftNote) => {
        if (!note.titulo.trim()) {
            errorToast("La nota necesita un título");
            return;
        }
        setSavingKey(note.key);
        try {
            const saved = await upsertNote({
                ...(note._id ? { _id: note._id } : {}),
                corte: corte.trim(),
                numero: note.numero,
                titulo: note.titulo.trim(),
                contenido: note.contenido,
                orden: note.orden,
            });
            setNotes((prev) => prev.map((n) => (n.key === note.key ? toDraft(saved) : n)));
            successToast("Nota guardada");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al guardar la nota");
        } finally {
            setSavingKey(null);
        }
    };

    const eliminar = async (note: DraftNote) => {
        if (!note._id) {
            setNotes((prev) => prev.filter((n) => n.key !== note.key));
            return;
        }
        if (!(await confirm(`¿Eliminar la nota "${note.titulo || note.numero}"?`))) return;
        try {
            await deleteNote(note._id);
            setNotes((prev) => prev.filter((n) => n.key !== note.key));
            successToast("Nota eliminada");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al eliminar la nota");
        }
    };

    const insertarPlantillas = async () => {
        setSeeding(true);
        try {
            await seedNotes(corte.trim());
            successToast("Plantillas NIIF insertadas");
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al insertar las plantillas");
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="led-section led-notes-section">
            <p className="pm-hint">Revelaciones NIIF por período de corte. Edita el título y el contenido de cada nota.</p>

            <div className="led-section__toolbar">
                <FilterField label="Corte" htmlFor="led-notes-corte" icon="ri-calendar-line">
                    <FieldControl
                        id="led-notes-corte"
                        type="text"
                        value={corte}
                        onChange={(e) => setCorte(e.target.value)}
                        placeholder="2026 o 2026-12-31"
                    />
                </FilterField>
                <button type="button" className="btn-secondary" onClick={insertarPlantillas} disabled={seeding}>
                    <i className="ri-file-add-line" aria-hidden /> {seeding ? "Insertando..." : "Insertar plantillas NIIF"}
                </button>
                <button type="button" className="btn-primary" onClick={nuevaNota}>
                    <i className="ri-add-line" aria-hidden /> Nueva nota
                </button>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : notes.length === 0 ? (
                <p className="pm-hint">No hay notas para el corte {corte}. Inserta las plantillas NIIF o crea una nota nueva.</p>
            ) : (
                <div className="led-notes-list">
                    {notes.map((n) => (
                        <article key={n.key} className="led-note-card">
                            <FilterField label={`Nota ${n.numero} — Título`} htmlFor={`note-title-${n.key}`} icon="ri-text">
                                <FieldControl
                                    id={`note-title-${n.key}`}
                                    type="text"
                                    value={n.titulo}
                                    onChange={(e) => setField(n.key, "titulo", e.target.value)}
                                    placeholder="Título de la nota"
                                />
                            </FilterField>
                            <FilterField label="Contenido" htmlFor={`note-body-${n.key}`} icon="ri-file-text-line">
                                <FieldControl
                                    as="textarea"
                                    id={`note-body-${n.key}`}
                                    rows={5}
                                    value={n.contenido}
                                    onChange={(e) => setField(n.key, "contenido", e.target.value)}
                                    placeholder="Revelación / contenido de la nota"
                                />
                            </FilterField>
                            <div className="led-form-actions led-form-actions--end">
                                <button type="button" className="btn-primary" onClick={() => guardar(n)} disabled={savingKey === n.key}>
                                    <i className="ri-save-line" aria-hidden /> {savingKey === n.key ? "Guardando..." : "Guardar"}
                                </button>
                                <button type="button" className="btn-secondary" onClick={() => eliminar(n)}>
                                    <i className="ri-delete-bin-line" aria-hidden /> Eliminar
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FinancialNotes;
