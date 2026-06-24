import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { ItemData } from "../../../types";
import { getAllItems } from "../../../services/items.service";
import ItemModal from "../../../components/modals/ItemModal/ItemModal";
import { formatCOP } from "../quotes.utils";
import "./SidePicker.css";

interface ProductPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onPick: (item: ItemData) => void;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Panel lateral para elegir un producto/servicio del catálogo, con opción de
 * CREAR uno nuevo y EDITAR uno existente (ambos persisten en BD vía ItemModal).
 */
const ProductPicker: React.FC<ProductPickerProps> = ({ isOpen, onClose, onPick }) => {
    const [items, setItems] = useState<ItemData[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    // ItemModal: crear (item=null) o editar (item con datos)
    const [itemModalOpen, setItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ItemData | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        let ignore = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        (async () => {
            try {
                const res = await getAllItems(1, 300);
                if (!ignore && res) setItems(res.items);
            } catch (e) {
                if (!ignore) toast.error(e instanceof Error ? e.message : "No se pudieron cargar los productos");
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [isOpen, refreshKey]);

    const filtered = useMemo(() => {
        const q = norm(search.trim());
        if (!q) return items;
        return items.filter((i) => norm(`${i.name} ${i.code ?? ""} ${i.description ?? ""}`).includes(q));
    }, [items, search]);

    const openCreate = () => {
        setEditingItem(null);
        setItemModalOpen(true);
    };
    const openEdit = (e: React.MouseEvent, item: ItemData) => {
        e.stopPropagation();
        setEditingItem(item);
        setItemModalOpen(true);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="side-picker">
                <div className="side-picker__overlay" onClick={onClose}></div>
                <div className="side-picker__panel" role="dialog" aria-modal="true" aria-label="Seleccionar producto o servicio">
                    <div className="side-picker__header">
                        <h2>Agregar Producto/Servicio</h2>
                        <button className="side-picker__close" onClick={onClose} aria-label="Cerrar">
                            <i className="ri-close-line"></i>
                        </button>
                    </div>
                    <div className="side-picker__content">
                        <div className="side-picker__search">
                            <i className="ri-search-line"></i>
                            <input type="search" placeholder="Buscar producto/servicio" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
                        </div>
                        <button className="side-picker__create" onClick={openCreate}>
                            <i className="ri-add-line"></i> Crear producto/servicio nuevo
                        </button>
                        <ul className="side-picker__list">
                            {loading ? (
                                <li className="side-picker__empty">Cargando productos...</li>
                            ) : filtered.length === 0 ? (
                                <li className="side-picker__empty">No hay productos para mostrar</li>
                            ) : (
                                filtered.map((it) => (
                                    <li key={it._id} className="side-picker__item" onClick={() => onPick(it)}>
                                        <div className="side-picker__item-main">
                                            <span className="side-picker__item-name">{it.name}</span>
                                            {it.code && <span className="side-picker__item-code">{it.code}</span>}
                                        </div>
                                        <span className="side-picker__item-price">{formatCOP(it.price)}</span>
                                        <button className="side-picker__item-edit" title="Editar producto" onClick={(e) => openEdit(e, it)}>
                                            <i className="ri-edit-line"></i>
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Crear/editar producto: persiste en BD; al guardar refresca el catálogo del picker. */}
            <ItemModal
                isOpen={itemModalOpen}
                onClose={() => setItemModalOpen(false)}
                onSuccess={() => {
                    setItemModalOpen(false);
                    setRefreshKey((k) => k + 1);
                }}
                item={editingItem}
            />
        </>
    );
};

export default ProductPicker;
