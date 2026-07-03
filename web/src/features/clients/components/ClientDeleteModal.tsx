import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { AppModal } from "../../../components/design-system";
import "./ClientDeleteModal.css";

type ClientDeleteModalProps = {
    client: { id: string; name: string } | null;
    loading: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
};

const ClientDeleteModal: React.FC<ClientDeleteModalProps> = ({ client, loading, onClose, onConfirm }) => {
    useBodyScrollLock(Boolean(client));

    if (!client) return null;

    return (
        <AppModal
            title="Eliminar cliente"
            titleIcon="ri-delete-bin-line"
            closeDisabled={loading}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="button" className="export-submit clients-delete-submit--danger" onClick={() => void onConfirm()} disabled={loading}>
                        {loading ? (
                            <>
                                <i className="ri-loader-4-line rotating" aria-hidden /> Eliminando…
                            </>
                        ) : (
                            "Eliminar"
                        )}
                    </button>
                </>
            }
        >
            <div className="clients-delete-summary">
                <div className="clients-delete-summary__row">
                    <span>Cliente</span>
                    <strong>{client.name}</strong>
                </div>
            </div>
            <p className="clients-delete-intro clients-delete-intro--danger">
                ¿Eliminar a <strong>{client.name}</strong>? Esta acción no se puede deshacer.
            </p>
        </AppModal>
    );
};

export default ClientDeleteModal;
