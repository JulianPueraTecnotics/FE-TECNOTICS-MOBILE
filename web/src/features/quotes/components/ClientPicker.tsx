import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { IExternUser } from "../../../types";
import { getAllClients, searchClients } from "../../../services/clients.service";
import { useDebouncedValue, FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import { AppDrawer } from "../../../components/design-system";
import "./SidePicker.css";

interface ClientPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onPick: (client: IExternUser) => void;
}

/** Panel lateral deslizante para elegir un cliente del portal (estilo fichas_tecnicas). */
const ClientPicker: React.FC<ClientPickerProps> = ({ isOpen, onClose, onPick }) => {
    const [clients, setClients] = useState<IExternUser[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);

    useEffect(() => {
        if (!isOpen) return;
        let ignore = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        (async () => {
            try {
                const q = debounced.trim();
                const res = q ? await searchClients(q, 1, 100) : await getAllClients(1, 100);
                if (!ignore && res) setClients(res.clients);
            } catch (e) {
                if (!ignore) toast.error(e instanceof Error ? e.message : "No se pudieron cargar los clientes");
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [isOpen, debounced]);

    const list = useMemo(() => clients, [clients]);

    if (!isOpen) return null;

    return (
        <AppDrawer
            title="Seleccionar cliente"
            titleIcon="ri-user-search-line"
            onClose={onClose}
        >
            <div className="side-picker__content side-picker__content--drawer">
                <div className="side-picker__search">
                    <i className="ri-search-line" aria-hidden />
                    <input
                        type="search"
                        placeholder="Buscar por nombre o documento"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                <ul className="side-picker__list">
                    {loading ? (
                        <li className="side-picker__empty">Cargando clientes...</li>
                    ) : list.length === 0 ? (
                        <li className="side-picker__empty">No hay clientes para mostrar</li>
                    ) : (
                        list.map((c) => (
                            <li key={c._id} className="side-picker__item" onClick={() => onPick(c)}>
                                <div className="side-picker__item-main">
                                    <span className="side-picker__item-name">{c.name}</span>
                                    <span className="side-picker__item-code">{c.doc_number}</span>
                                </div>
                                {c.email && <span className="side-picker__item-sub">{c.email}</span>}
                            </li>
                        ))
                    )}
                </ul>
            </div>
        </AppDrawer>
    );
};

export default ClientPicker;
