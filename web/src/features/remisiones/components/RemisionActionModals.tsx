import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import type { IRemision } from "../../../types";
import { REMISION_STATUS_LABELS, type RemisionStatus } from "../../../types";
import { AppModal, AppDrawer } from "../../../components/design-system";
import { formatCOP } from "../../quotes/quotes.utils";
import "./RemisionActionModals.css";

export type RemisionActionKind = "send" | "delete";

export type RemisionActionState = {
    kind: RemisionActionKind;
    remision: IRemision;
} | null;

type RemisionActionModalsProps = {
    action: RemisionActionState;
    loading: boolean;
    onClose: () => void;
    onSend: () => Promise<void>;
    onDelete: () => Promise<void>;
    sourceLabel: (r: IRemision) => string;
};

function RemisionSummary({ remision, sourceLabel }: { remision: IRemision; sourceLabel: (r: IRemision) => string }) {
    return (
        <div className="remisiones-action-summary">
            <div className="remisiones-action-summary__row">
                <span>Remisión</span>
                <strong>{remision.number}</strong>
            </div>
            <div className="remisiones-action-summary__row">
                <span>Origen</span>
                <strong>{sourceLabel(remision)}</strong>
            </div>
            <div className="remisiones-action-summary__row">
                <span>Cliente</span>
                <strong>{remision.client_name || "—"}</strong>
            </div>
            <div className="remisiones-action-summary__row">
                <span>Total</span>
                <strong>{formatCOP(remision.total)}</strong>
            </div>
            <div className="remisiones-action-summary__row">
                <span>Estado</span>
                <strong>{REMISION_STATUS_LABELS[remision.status as RemisionStatus] ?? remision.status}</strong>
            </div>
        </div>
    );
}

const RemisionActionModals: React.FC<RemisionActionModalsProps> = ({
    action,
    loading,
    onClose,
    onSend,
    onDelete,
    sourceLabel,
}) => {
    useBodyScrollLock(Boolean(action));

    if (!action) return null;

    const { kind, remision } = action;

    if (kind === "send") {
        return (
            <AppDrawer
                title="Enviar link de firma"
                titleIcon="ri-mail-send-line"
                wide
                closeDisabled={loading}
                onClose={onClose}
                footer={
                    <>
                        <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="button" className="export-submit" onClick={() => void onSend()} disabled={loading}>
                            {loading ? (
                                <>
                                    <i className="ri-loader-4-line rotating" aria-hidden /> Enviando…
                                </>
                            ) : (
                                "Enviar link"
                            )}
                        </button>
                    </>
                }
            >
                <RemisionSummary remision={remision} sourceLabel={sourceLabel} />
                <p className="remisiones-action-intro">
                    Se enviará al cliente un enlace para <strong>firmar la entrega</strong> de la remisión{" "}
                    <strong>{remision.number}</strong>
                    {remision.client_email ? ` al correo ${remision.client_email}` : ""}.
                </p>
                {remision.status === "signed" && (
                    <p className="remisiones-action-hint">Esta remisión ya está firmada; el envío puede ser solo informativo.</p>
                )}
            </AppDrawer>
        );
    }

    return (
        <AppModal
            title="Eliminar remisión"
            titleIcon="ri-delete-bin-line"
            closeDisabled={loading}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="button" className="export-submit remisiones-action-submit--danger" onClick={() => void onDelete()} disabled={loading}>
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
            <RemisionSummary remision={remision} sourceLabel={sourceLabel} />
            <p className="remisiones-action-intro remisiones-action-intro--danger">
                ¿Eliminar <strong>{remision.number}</strong>? El documento origen no se ve afectado. Esta acción no se puede deshacer.
            </p>
        </AppModal>
    );
};

export default RemisionActionModals;
