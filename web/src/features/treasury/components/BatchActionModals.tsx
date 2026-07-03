import type { PaymentBatch } from "../treasury.types";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { AppModal, AppDrawer } from "../../../components/design-system";
import "./BatchActionModals.css";

export type BatchActionKind = "download" | "sent" | "reconcile" | "comprobantes";

export type BatchConfirmAction = {
    kind: BatchActionKind;
    batch: PaymentBatch;
} | null;

const STATUS_LABEL: Record<string, string> = {
    generated: "Generado",
    sent: "Enviado al banco",
    reconciled: "Conciliado",
};

type BatchActionModalsProps = {
    drawerBatch: PaymentBatch | null;
    confirmAction: BatchConfirmAction;
    loading: boolean;
    formatCOP: (n: number) => string;
    formatDate: (d?: string) => string;
    onCloseDrawer: () => void;
    onOpenConfirm: (kind: BatchActionKind, batch: PaymentBatch) => void;
    onCloseConfirm: () => void;
    onConfirm: (kind: BatchActionKind, batch: PaymentBatch) => Promise<void>;
};

function BatchSummary({
    batch,
    formatCOP,
    formatDate,
}: {
    batch: PaymentBatch;
    formatCOP: (n: number) => string;
    formatDate: (d?: string) => string;
}) {
    return (
        <div className="batch-action-summary">
            <div className="batch-action-summary__row">
                <span>Lote</span>
                <strong>#{batch.consecutivo}</strong>
            </div>
            <div className="batch-action-summary__row">
                <span>Banco</span>
                <strong>{batch.bank?.nombre ?? "—"}</strong>
            </div>
            <div className="batch-action-summary__row">
                <span>Fecha</span>
                <strong>{formatDate(batch.generado_en)}</strong>
            </div>
            <div className="batch-action-summary__row">
                <span>Registros</span>
                <strong>{batch.total_registros}</strong>
            </div>
            <div className="batch-action-summary__row">
                <span>Total</span>
                <strong className="batch-action-summary__amount">{formatCOP(batch.total_amount)}</strong>
            </div>
            <div className="batch-action-summary__row">
                <span>Estado</span>
                <strong>{STATUS_LABEL[batch.status] ?? batch.status}</strong>
            </div>
        </div>
    );
}

const ACTION_META: Record<
    BatchActionKind,
    { icon: string; title: string; description: string; modalTitle: string; modalIcon: string; submitLabel: string; danger?: boolean }
> = {
    download: {
        icon: "ri-download-2-line",
        title: "Descargar archivo",
        description: "Obtén el archivo plano ACH para cargarlo en el portal del banco.",
        modalTitle: "Descargar archivo del lote",
        modalIcon: "ri-download-2-line",
        submitLabel: "Descargar",
    },
    sent: {
        icon: "ri-send-plane-line",
        title: "Marcar como enviado",
        description: "Indica que ya subiste el archivo al banco y está en proceso de pago.",
        modalTitle: "Marcar lote como enviado",
        modalIcon: "ri-send-plane-line",
        submitLabel: "Marcar enviado",
    },
    reconcile: {
        icon: "ri-check-double-line",
        title: "Conciliar lote",
        description: "Confirma que el banco pagó. Las facturas del lote quedarán marcadas como pagadas.",
        modalTitle: "Conciliar lote de pago",
        modalIcon: "ri-check-double-line",
        submitLabel: "Conciliar",
        danger: true,
    },
    comprobantes: {
        icon: "ri-mail-send-line",
        title: "Enviar comprobantes",
        description: "Envía por correo el comprobante de egreso a cada proveedor del lote.",
        modalTitle: "Enviar comprobantes de egreso",
        modalIcon: "ri-mail-send-line",
        submitLabel: "Enviar comprobantes",
    },
};

function availableActions(status: PaymentBatch["status"]): BatchActionKind[] {
    const actions: BatchActionKind[] = ["download"];
    if (status === "generated") actions.push("sent");
    if (status !== "reconciled") actions.push("reconcile");
    if (status === "reconciled") actions.push("comprobantes");
    return actions;
}

const BatchActionModals: React.FC<BatchActionModalsProps> = ({
    drawerBatch,
    confirmAction,
    loading,
    formatCOP,
    formatDate,
    onCloseDrawer,
    onOpenConfirm,
    onCloseConfirm,
    onConfirm,
}) => {
    useBodyScrollLock(Boolean(drawerBatch || confirmAction));

    const confirmMeta = confirmAction ? ACTION_META[confirmAction.kind] : null;

    return (
        <>
            {drawerBatch && !confirmAction && (
                <AppDrawer
                    title={`Lote #${drawerBatch.consecutivo}`}
                    titleIcon="ri-stack-line"
                    wide
                    closeDisabled={loading}
                    onClose={onCloseDrawer}
                    footer={
                        <button type="button" className="export-cancel" onClick={onCloseDrawer} disabled={loading}>
                            Cerrar
                        </button>
                    }
                >
                    <BatchSummary batch={drawerBatch} formatCOP={formatCOP} formatDate={formatDate} />
                    <p className="batch-action-intro">Elige qué quieres hacer con este lote:</p>
                    <div className="batch-action-list">
                        {availableActions(drawerBatch.status).map((kind) => {
                            const meta = ACTION_META[kind];
                            return (
                                <button
                                    key={kind}
                                    type="button"
                                    className="batch-action-tile"
                                    disabled={loading}
                                    onClick={() => {
                                        onCloseDrawer();
                                        onOpenConfirm(kind, drawerBatch);
                                    }}
                                >
                                    <span className="batch-action-tile__icon" aria-hidden>
                                        <i className={meta.icon} />
                                    </span>
                                    <span className="batch-action-tile__body">
                                        <strong>{meta.title}</strong>
                                        <span>{meta.description}</span>
                                    </span>
                                    <i className="ri-arrow-right-s-line batch-action-tile__chevron" aria-hidden />
                                </button>
                            );
                        })}
                    </div>
                </AppDrawer>
            )}

            {confirmAction && confirmMeta && (
                <AppModal
                    title={confirmMeta.modalTitle}
                    titleIcon={confirmMeta.modalIcon}
                    closeDisabled={loading}
                    onClose={onCloseConfirm}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={onCloseConfirm} disabled={loading}>
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={`export-submit${confirmMeta.danger ? " batch-action-submit--danger" : ""}`}
                                onClick={() => void onConfirm(confirmAction.kind, confirmAction.batch)}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <i className="ri-loader-4-line rotating" aria-hidden /> Procesando…
                                    </>
                                ) : (
                                    confirmMeta.submitLabel
                                )}
                            </button>
                        </>
                    }
                >
                    <BatchSummary batch={confirmAction.batch} formatCOP={formatCOP} formatDate={formatDate} />
                    {confirmAction.kind === "download" && (
                        <p className="batch-action-intro">
                            Se descargará <strong>{confirmAction.batch.archivo_nombre || "lote.txt"}</strong> listo para el banco.
                        </p>
                    )}
                    {confirmAction.kind === "sent" && (
                        <p className="batch-action-intro">
                            El lote <strong>#{confirmAction.batch.consecutivo}</strong> pasará a estado <strong>Enviado al banco</strong>.
                        </p>
                    )}
                    {confirmAction.kind === "reconcile" && (
                        <p className="batch-action-intro batch-action-intro--warn">
                            ¿Confirmas que el lote <strong>#{confirmAction.batch.consecutivo}</strong> fue pagado? Las facturas incluidas se
                            marcarán como pagadas.
                        </p>
                    )}
                    {confirmAction.kind === "comprobantes" && (
                        <p className="batch-action-intro">
                            Se enviarán comprobantes de egreso por correo a los proveedores del lote{" "}
                            <strong>#{confirmAction.batch.consecutivo}</strong>.
                        </p>
                    )}
                </AppModal>
            )}
        </>
    );
};

export default BatchActionModals;
