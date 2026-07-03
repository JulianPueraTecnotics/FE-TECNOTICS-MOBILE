import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import type { InvoiceTemplate } from "../../../types";
import { RECURRENCE_LABELS, type RecurrenceType } from "../../../types";
import { AppModal, AppDrawer } from "../../../components/design-system";
import { formatCOP } from "../../../utils/format";
import "./PlantillaActionModals.css";

export type PlantillaActionKind = "recreate" | "remove";

export type PlantillaActionState = {
    kind: PlantillaActionKind;
    template: InvoiceTemplate;
} | null;

type PlantillaActionModalsProps = {
    action: PlantillaActionState;
    loading: boolean;
    onClose: () => void;
    onRecreate: () => Promise<void>;
    onRemove: () => Promise<void>;
    estadoTexto: (t: InvoiceTemplate) => string;
};

function PlantillaSummary({ template, estadoTexto }: { template: InvoiceTemplate; estadoTexto: (t: InvoiceTemplate) => string }) {
    return (
        <div className="plantillas-action-summary">
            <div className="plantillas-action-summary__row">
                <span>Documento</span>
                <strong>{template.number}</strong>
            </div>
            <div className="plantillas-action-summary__row">
                <span>Cliente</span>
                <strong>{template.client_name || "—"}</strong>
            </div>
            <div className="plantillas-action-summary__row">
                <span>Total</span>
                <strong>{formatCOP(template.total)}</strong>
            </div>
            <div className="plantillas-action-summary__row">
                <span>Recurrencia</span>
                <strong>{RECURRENCE_LABELS[template.recurrence as RecurrenceType] ?? template.recurrence}</strong>
            </div>
            <div className="plantillas-action-summary__row">
                <span>Próx. facturación</span>
                <strong>{estadoTexto(template)}</strong>
            </div>
        </div>
    );
}

const PlantillaActionModals: React.FC<PlantillaActionModalsProps> = ({
    action,
    loading,
    onClose,
    onRecreate,
    onRemove,
    estadoTexto,
}) => {
    useBodyScrollLock(Boolean(action));

    if (!action) return null;

    const { kind, template } = action;

    if (kind === "recreate") {
        return (
            <AppDrawer
                title="Recrear factura"
                titleIcon="ri-file-copy-line"
                wide
                closeDisabled={loading}
                onClose={onClose}
                footer={
                    <>
                        <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="button" className="export-submit" onClick={() => void onRecreate()} disabled={loading}>
                            {loading ? (
                                <>
                                    <i className="ri-loader-4-line rotating" aria-hidden /> Abriendo…
                                </>
                            ) : (
                                "Recrear factura"
                            )}
                        </button>
                    </>
                }
            >
                <PlantillaSummary template={template} estadoTexto={estadoTexto} />
                <p className="plantillas-action-intro">
                    Se abrirá <strong>Facturar</strong> con los datos de la plantilla <strong>{template.number}</strong>. Podrás revisar
                    líneas, cliente y totales antes de emitir.
                </p>
                {template.recurrence !== "none" && (
                    <p className="plantillas-action-hint">
                        Al emitir la factura, se registrará la facturación recurrente y se calculará la próxima fecha automáticamente.
                    </p>
                )}
            </AppDrawer>
        );
    }

    return (
        <AppModal
            title="Quitar de plantillas"
            titleIcon="ri-bookmark-off-line"
            closeDisabled={loading}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="button" className="export-submit" onClick={() => void onRemove()} disabled={loading}>
                        {loading ? (
                            <>
                                <i className="ri-loader-4-line rotating" aria-hidden /> Quitando…
                            </>
                        ) : (
                            "Quitar de plantillas"
                        )}
                    </button>
                </>
            }
        >
            <PlantillaSummary template={template} estadoTexto={estadoTexto} />
            <p className="plantillas-action-intro">
                <strong>{template.number}</strong> dejará de aparecer en Facturas de plantilla. La factura original no se elimina.
            </p>
        </AppModal>
    );
};

export default PlantillaActionModals;
