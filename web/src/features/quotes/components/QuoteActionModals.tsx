import { useEffect, useState } from "react";
import type { IQuote } from "../../../types";
import { QUOTE_STATUS_LABELS } from "../../../types";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { AppModal, AppDrawer, FilterField, FieldControl } from "../../../components/design-system";
import { formatCOP } from "../quotes.utils";
import "./QuoteActionModals.css";

export type QuoteActionKind = "send" | "convert" | "remision" | "delete";

export type QuoteActionState = {
    kind: QuoteActionKind;
    quote: IQuote;
} | null;

type QuoteActionModalsProps = {
    action: QuoteActionState;
    loading: boolean;
    onClose: () => void;
    onSend: (extraRecipients: string) => Promise<void>;
    onConvert: () => Promise<void>;
    onRemision: () => Promise<void>;
    onDelete: () => Promise<void>;
};

function QuoteSummary({ quote }: { quote: IQuote }) {
    return (
        <div className="quotes-action-summary">
            <div className="quotes-action-summary__row">
                <span>Cotización</span>
                <strong>{quote.number}</strong>
            </div>
            <div className="quotes-action-summary__row">
                <span>Cliente</span>
                <strong>{quote.client_name || "—"}</strong>
            </div>
            <div className="quotes-action-summary__row">
                <span>Total</span>
                <strong>{formatCOP(quote.totals?.total)}</strong>
            </div>
            <div className="quotes-action-summary__row">
                <span>Estado</span>
                <strong>{QUOTE_STATUS_LABELS[quote.status] ?? quote.status}</strong>
            </div>
        </div>
    );
}

const QuoteActionModals: React.FC<QuoteActionModalsProps> = ({
    action,
    loading,
    onClose,
    onSend,
    onConvert,
    onRemision,
    onDelete,
}) => {
    const [extraEmails, setExtraEmails] = useState("");

    useBodyScrollLock(Boolean(action));

    useEffect(() => {
        if (action?.kind === "send") {
            setExtraEmails("");
        }
    }, [action?.kind, action?.quote._id]);

    if (!action) return null;

    const { kind, quote } = action;

    if (kind === "send") {
        return (
            <AppDrawer
                title="Enviar cotización"
                titleIcon="ri-mail-send-line"
                wide
                closeDisabled={loading}
                onClose={onClose}
                footer={
                    <>
                        <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="button" className="export-submit" onClick={() => void onSend(extraEmails)} disabled={loading}>
                            {loading ? (
                                <>
                                    <i className="ri-loader-4-line rotating" aria-hidden /> Enviando…
                                </>
                            ) : (
                                "Enviar por correo"
                            )}
                        </button>
                    </>
                }
            >
                <QuoteSummary quote={quote} />
                <p className="quotes-action-intro">
                    Se enviará la cotización <strong>{quote.number}</strong> al correo del cliente
                    {quote.client_email ? ` (${quote.client_email})` : ""}.
                </p>
                <FilterField label="Correos adicionales (opcional)" htmlFor="quote-send-extra" icon="ri-mail-add-line">
                    <FieldControl
                        id="quote-send-extra"
                        type="text"
                        placeholder="otro@correo.com, copia@empresa.co"
                        value={extraEmails}
                        onChange={(e) => setExtraEmails(e.target.value)}
                        disabled={loading}
                    />
                </FilterField>
                <small className="quotes-action-hint">Separa varios correos con coma. Si lo dejas vacío, solo se usa el correo del cliente.</small>
            </AppDrawer>
        );
    }

    if (kind === "convert") {
        return (
            <AppModal
                title="Convertir en factura"
                titleIcon="ri-file-transfer-line"
                closeDisabled={loading}
                onClose={onClose}
                footer={
                    <>
                        <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="button" className="export-submit" onClick={() => void onConvert()} disabled={loading}>
                            {loading ? (
                                <>
                                    <i className="ri-loader-4-line rotating" aria-hidden /> Convirtiendo…
                                </>
                            ) : (
                                "Convertir en factura"
                            )}
                        </button>
                    </>
                }
            >
                <QuoteSummary quote={quote} />
                <p className="quotes-action-intro">
                    Se creará un <strong>borrador de factura</strong> a partir de esta cotización. Podrás revisarla y enviarla a la DIAN desde
                    Facturar o Documentos.
                </p>
            </AppModal>
        );
    }

    if (kind === "remision") {
        return (
            <AppModal
                title="Generar remisión"
                titleIcon="ri-truck-line"
                closeDisabled={loading}
                onClose={onClose}
                footer={
                    <>
                        <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="button" className="export-submit" onClick={() => void onRemision()} disabled={loading}>
                            {loading ? (
                                <>
                                    <i className="ri-loader-4-line rotating" aria-hidden /> Generando…
                                </>
                            ) : (
                                "Generar y enviar"
                            )}
                        </button>
                    </>
                }
            >
                <QuoteSummary quote={quote} />
                <p className="quotes-action-intro">
                    Se generará una remisión vinculada a esta cotización y se enviará al cliente un enlace para <strong>firmar la entrega</strong>.
                </p>
            </AppModal>
        );
    }

    return (
        <AppModal
            title="Eliminar cotización"
            titleIcon="ri-delete-bin-line"
            closeDisabled={loading}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="button" className="export-submit quotes-action-submit--danger" onClick={() => void onDelete()} disabled={loading}>
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
            <QuoteSummary quote={quote} />
            <p className="quotes-action-intro quotes-action-intro--danger">
                ¿Eliminar <strong>{quote.number}</strong>? Esta acción no se puede deshacer.
            </p>
        </AppModal>
    );
};

export default QuoteActionModals;
