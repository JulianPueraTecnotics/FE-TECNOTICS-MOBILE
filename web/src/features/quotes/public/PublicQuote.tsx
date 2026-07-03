import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import type { IQuote } from "../../../types";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "../../../types";
import { getPublicQuote, downloadPublicQuote, approvePublicQuote } from "../../../services/quotes.service";
import { formatCOP } from "../quotes.utils";
import { AppModal, FilterField, FieldControl } from "../../../components/design-system";
import "./PublicQuote.css";

const formatDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

const PublicQuote: React.FC = () => {
    const { slug = "" } = useParams();
    const [quote, setQuote] = useState<IQuote | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [showApprove, setShowApprove] = useState(false);
    const [code, setCode] = useState("");
    const [approving, setApproving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getPublicQuote(slug);
            if (res?.quote) setQuote(res.quote);
            else setNotFound(true);
        } catch {
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    }, [slug]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
    }, [load]);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await downloadPublicQuote(slug);
            const uri = res?.data_uri || (res?.base64_quote ? `data:${res.mime_type || "application/pdf"};base64,${res.base64_quote}` : null);
            if (!uri) throw new Error("La respuesta no contiene el PDF");
            const link = document.createElement("a");
            link.href = uri;
            link.download = res?.file_name || `${quote?.number || "cotizacion"}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo descargar");
        } finally {
            setDownloading(false);
        }
    };

    const handleApprove = async () => {
        if (!code.trim()) {
            toast.error("Ingresa el código de aprobación");
            return;
        }
        setApproving(true);
        try {
            await approvePublicQuote(slug, code.trim());
            toast.success("¡Cotización aprobada!");
            setShowApprove(false);
            load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Código inválido");
        } finally {
            setApproving(false);
        }
    };

    if (loading) {
        return (
            <main className="pubq-state">
                <p>Cargando cotización...</p>
            </main>
        );
    }
    if (notFound || !quote) {
        return (
            <main className="pubq-state">
                <i className="ri-error-warning-line"></i>
                <h1>Cotización no encontrada</h1>
                <p>El enlace no es válido o la cotización fue eliminada.</p>
            </main>
        );
    }

    const t = quote.totals;

    return (
        <main className="pubq">
            <div className="pubq-doc">
                {/* Encabezado */}
                <header className="pubq-head">
                    <div>
                        <h1 className="pubq-title">Cotización</h1>
                        <p className="pubq-number">{quote.number}</p>
                    </div>
                    <div className="pubq-head-right">
                        {quote.approved && <span className="pubq-badge pubq-badge--approved">Aprobada ✓</span>}
                        {!quote.approved && (
                            <span className={`pubq-badge pubq-badge--${quote.status}`}>
                                {QUOTE_STATUS_LABELS[quote.status as QuoteStatus] ?? quote.status}
                            </span>
                        )}
                        {quote.qr?.url && <img className="pubq-qr" src={quote.qr.url} alt="QR" />}
                    </div>
                </header>

                {/* Cliente + detalles */}
                <section className="pubq-cards">
                    <div className="pubq-card">
                        <h4>Cliente</h4>
                        <div className="pubq-card-big">{quote.client_name}</div>
                        {quote.client_doc && <div className="pubq-card-row">Doc: {quote.client_doc}</div>}
                        {quote.client_phone && <div className="pubq-card-row">Tel: {quote.client_phone}</div>}
                        {quote.client_email && <div className="pubq-card-row">{quote.client_email}</div>}
                    </div>
                    <div className="pubq-card">
                        <h4>Detalles</h4>
                        <div className="pubq-card-row">Elaboración: {formatDate(quote.createdAt || quote.created_at)}</div>
                        <div className="pubq-card-row">Vence: {formatDate(quote.valid_until)}</div>
                        <div className="pubq-card-row">Forma de pago: {quote.payment_form}</div>
                        {quote.payment_method && <div className="pubq-card-row">Medio: {quote.payment_method}</div>}
                    </div>
                </section>

                {/* Ítems */}
                <table className="pubq-table">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Detalle</th>
                            <th className="r">Cant.</th>
                            <th className="r">Vr. Unitario</th>
                            <th className="r">IVA</th>
                            <th className="r">Vr. Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quote.lines.map((l, i) => (
                            <tr key={i}>
                                <td>{l.code || "—"}</td>
                                <td>
                                    <div className="pubq-it-name">{l.name}</div>
                                    {l.description && <div className="pubq-it-desc">{l.description}</div>}
                                </td>
                                <td className="r">{l.quantity}</td>
                                <td className="r">{formatCOP(l.price)}</td>
                                <td className="r">{l.iva}%</td>
                                <td className="r">{formatCOP(l.price * l.quantity)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totales */}
                <section className="pubq-bottom">
                    <div className="pubq-notas">
                        {quote.notes && (
                            <>
                                <div className="pubq-lbl">Observaciones</div>
                                <p>{quote.notes}</p>
                            </>
                        )}
                        {t.valor_letras && <p className="pubq-letras">{t.valor_letras}</p>}
                    </div>
                    <div className="pubq-tot">
                        <div className="pubq-tl">
                            <span>Valor bruto</span>
                            <strong>{formatCOP(t.bruto)}</strong>
                        </div>
                        {t.descuento > 0 && (
                            <div className="pubq-tl">
                                <span>Descuentos</span>
                                <strong>-{formatCOP(t.descuento)}</strong>
                            </div>
                        )}
                        <div className="pubq-tl">
                            <span>Subtotal</span>
                            <strong>{formatCOP(t.subtotal)}</strong>
                        </div>
                        <div className="pubq-tl">
                            <span>IVA</span>
                            <strong>{formatCOP(t.iva)}</strong>
                        </div>
                        {t.retenciones > 0 && (
                            <div className="pubq-tl">
                                <span>Retención ({t.retenciones}%)</span>
                                <strong>-{formatCOP(t.subtotal + t.iva - t.total)}</strong>
                            </div>
                        )}
                        <div className="pubq-tl pubq-tl--grand">
                            <span>Total</span>
                            <strong>{formatCOP(t.total)}</strong>
                        </div>
                    </div>
                </section>

                {/* Acciones */}
                <footer className="pubq-actions">
                    <button type="button" className="btn-secondary pubq-btn" onClick={handleDownload} disabled={downloading}>
                        <i className={downloading ? "ri-loader-4-line rotating" : "ri-download-line"}></i> Descargar PDF
                    </button>
                    {!quote.approved && (
                        <button type="button" className="btn-primary pubq-btn" onClick={() => setShowApprove(true)}>
                            <i className="ri-check-double-line"></i> Aprobar cotización
                        </button>
                    )}
                </footer>
            </div>

            {showApprove && (
                <AppModal
                    title="Aprobar cotización"
                    titleIcon="ri-check-double-line"
                    onClose={() => setShowApprove(false)}
                    closeDisabled={approving}
                    compact
                    footer={
                        <>
                            <button type="button" className="btn-secondary" onClick={() => setShowApprove(false)} disabled={approving}>
                                Cancelar
                            </button>
                            <button type="button" className="btn-primary" onClick={handleApprove} disabled={approving}>
                                {approving ? "Aprobando..." : "Aprobar"}
                            </button>
                        </>
                    }
                >
                    <p className="pubq-modal-text">Ingresa el código de aprobación que te compartió la empresa.</p>
                    <FilterField label="Código de aprobación" htmlFor="pubq-approve-code" icon="ri-shield-keyhole-line">
                        <FieldControl
                            id="pubq-approve-code"
                            type="text"
                            inputMode="numeric"
                            placeholder="Código de aprobación"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            disabled={approving}
                            className="pubq-code-input"
                            autoFocus
                        />
                    </FilterField>
                </AppModal>
            )}
        </main>
    );
};

export default PublicQuote;
