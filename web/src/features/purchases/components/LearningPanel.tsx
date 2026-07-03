import { useCallback, useEffect, useState } from "react";
import { getLessons, deleteLesson, type ParametrizationLesson } from "../supplierItems.service";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal, SearchField } from "../../../components/design-system";
import "./PurchaseModals.css";
import "../../ledger/page/Accounting.css";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const acc = (p?: { niif?: string; colgaap?: string }) => p?.niif || p?.colgaap || "—";

/**
 * Panel de AUTOAPRENDIZAJE: muestra las parametrizaciones que el usuario ha
 * confirmado (aceptando o corrigiendo la IA). La IA usa estas lecciones como
 * ejemplos para productos parecidos. Aquí se pueden revisar y borrar si hubo un error.
 */
const LearningPanel: React.FC<Props> = ({ isOpen, onClose }) => {
    const [lessons, setLessons] = useState<ParametrizationLesson[]>([]);
    const [totalCorregidas, setTotalCorregidas] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getLessons(debounced.trim(), 1);
            setLessons(res.lessons);
            setTotalCorregidas(res.total_corregidas);
            setTotal(res.pagination.total);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar el autoaprendizaje");
        } finally {
            setLoading(false);
        }
    }, [debounced]);

    useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

    if (!isOpen) return null;

    const remove = async (id: string) => {
        try {
            await deleteLesson(id);
            successToast("Lección eliminada");
            setLessons((prev) => prev.filter((l) => l._id !== id));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo eliminar");
        }
    };

    return (
        <AppModal
            wide
            title="Autoaprendizaje de parametrización"
            titleIcon="ri-brain-line"
            onClose={onClose}
            footer={<button type="button" className="export-submit" onClick={onClose}>Cerrar</button>}
        >
                    <p className="pm-hint">
                        La IA aprende de cada parametrización que confirmas. Tiene <strong>{total}</strong> lección(es) aprendidas
                        {totalCorregidas > 0 ? <>, de las cuales <strong>{totalCorregidas}</strong> fueron correcciones tuyas</> : null}.
                        Cuando aparezca un producto igual o parecido del mismo proveedor, reutilizará estas cuentas.
                    </p>
                    <SearchField
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar producto, proveedor o NIT"
                        aria-label="Buscar lecciones de autoaprendizaje"
                    />

                    {loading ? (
                        <p className="pm-hint">Cargando…</p>
                    ) : lessons.length === 0 ? (
                        <p className="pm-hint">Aún no hay lecciones. Confirma la parametrización de un producto y la IA empezará a aprender.</p>
                    ) : (
                        <table className="acc-table" style={{ marginTop: 4 }}>
                            <thead><tr><th>Producto</th><th>Proveedor</th><th>Gasto</th><th>CxP</th><th>Retef.</th><th>Categoría</th><th></th></tr></thead>
                            <tbody>
                                {lessons.map((l) => (
                                    <tr key={l._id}>
                                        <td><strong>{l.codigo || "—"}</strong><br /><span style={{ color: "var(--text-muted)", fontSize: ".8rem" }}>{l.descripcion}</span></td>
                                        <td>{l.supplier_name || l.supplier_doc}<br /><span style={{ color: "var(--text-muted)", fontSize: ".78rem" }}>{l.supplier_doc}</span></td>
                                        <td>{acc(l.cuenta_gasto_costo)}</td>
                                        <td>{acc(l.cuenta_por_pagar)}</td>
                                        <td>{l.retefuente ? `${l.retefuente}%` : "—"}</td>
                                        <td>{l.retencion_categoria ?? "—"}{l.corregido ? <span title="Corregido por ti" style={{ marginLeft: 6, color: "var(--accent-teal)" }}><i className="ri-user-star-line" /></span> : null}</td>
                                        <td><button className="btn-icon" title="Olvidar esta lección" onClick={() => remove(l._id)}><i className="ri-delete-bin-line" /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
        </AppModal>
    );
};

export default LearningPanel;
