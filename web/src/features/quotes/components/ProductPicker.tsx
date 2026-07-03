import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { ItemData } from "../../../types";
import { getAllItems } from "../../../services/items.service";
import ItemModal from "../../../components/modals/ItemModal/ItemModal";
import { AppDrawer } from "../../../components/design-system";
import { formatCOP } from "../quotes.utils";
import "./SidePicker.css";

interface ProductPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onPick: (item: ItemData) => void;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Panel lateral para elegir un producto/servicio del catálogo, con opción de
 * CREAR uno nuevo y EDITAR uno existente (ambos persisten en BD vía ItemModal).
 */
const ProductPicker: React.FC<ProductPickerProps> = ({ isOpen, onClose, onPick }) => {
    const [items, setItems] = useState<ItemData[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
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
            <AppDrawer
                title="Agregar Producto/Servicio"
                titleIcon="ri-shopping-bag-line"
                onClose={onClose}
            >
                <div className="side-picker__content side-picker__content--drawer">
                    <div className="side-picker__search">
                        <i className="ri-search-line" aria-hidden />
                        <input type="search" placeholder="Buscar producto/servicio" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
                    </div>
                    <button type="button" className="side-picker__create" onClick={openCreate}>
                        <i className="ri-add-line" aria-hidden /> Crear producto/servicio nuevo
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
                                        <i className="ri-edit-line" aria-hidden />
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            </AppDrawer>

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
