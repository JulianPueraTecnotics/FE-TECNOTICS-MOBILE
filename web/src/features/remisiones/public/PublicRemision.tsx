import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import type { IRemision } from "../../../types";
import { getPublicRemision, downloadPublicRemision, signPublicRemision } from "../../../services/remisiones.service";
import { formatCOP } from "../../quotes/quotes.utils";
import SignaturePad, { type SignaturePadHandle } from "../components/SignaturePad";
import { FilterField, FieldControl } from "../../../components/design-system";
import "./PublicRemision.css";

const PublicRemision: React.FC = () => {
    const { slug = "" } = useParams();
    const [params] = useSearchParams();
    const token = params.get("t") ?? "";

    const [remision, setRemision] = useState<IRemision | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [signing, setSigning] = useState(false);
    const [signedBy, setSignedBy] = useState("");
    const padRef = useRef<SignaturePadHandle>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getPublicRemision(slug);
            if (res?.remision) {
                setRemision(res.remision);
                setSignedBy(res.remision.client_name ?? "");
            } else setNotFound(true);
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
            const res = await downloadPublicRemision(slug);
            const uri = res?.data_uri || (res?.base64_remision ? `data:${res.mime_type || "application/pdf"};base64,${res.base64_remision}` : null);
            if (!uri) throw new Error("La respuesta no contiene el PDF");
            const link = document.createElement("a");
            link.href = uri;
            link.download = res?.file_name || `${remision?.number || "remision"}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo descargar");
        } finally {
            setDownloading(false);
        }
    };

    const handleSign = async () => {
        const dataUrl = padRef.current?.getDataUrl();
        if (!dataUrl) {
            toast.error("Dibuja tu firma primero");
            return;
        }
        setSigning(true);
        try {
            await signPublicRemision(slug, token, dataUrl, signedBy.trim() || undefined);
            toast.success("¡Remisión firmada! Gracias.");
            load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo firmar");
        } finally {
            setSigning(false);
        }
    };

    if (loading) {
        return (
            <main className="pubr-state">
                <p>Cargando remisión...</p>
            </main>
        );
    }
    if (notFound || !remision) {
        return (
            <main className="pubr-state">
                <i className="ri-error-warning-line"></i>
                <h1>Remisión no encontrada</h1>
                <p>El enlace no es válido o la remisión fue eliminada.</p>
            </main>
        );
    }

    const yaFirmada = remision.status === "signed";

    return (
        <main className="pubr">
            <div className="pubr-doc">
                <header className="pubr-head">
                    <div>
                        <h1 className="pubr-title">Remisión de entrega</h1>
                        <p className="pubr-number">{remision.number}</p>
                    </div>
                    <span className={`pubr-badge pubr-badge--${yaFirmada ? "signed" : "pending"}`}>
                        {yaFirmada ? "Firmada ✓" : "Pendiente de firma"}
                    </span>
                </header>

                <section className="pubr-cards">
                    <div className="pubr-card">
                        <h4>Entregar a</h4>
                        <div className="pubr-card-big">{remision.client_name}</div>
                        {remision.client_doc && <div className="pubr-card-row">Doc: {remision.client_doc}</div>}
                        {remision.client_address && <div className="pubr-card-row">{remision.client_address}</div>}
                    </div>
                    <div className="pubr-card">
                        <h4>Detalles</h4>
                        {remision.source_number && <div className="pubr-card-row">Documento: {remision.source_number}</div>}
                        <div className="pubr-card-row">Total: {formatCOP(remision.total)}</div>
                    </div>
                </section>

                <table className="pubr-table">
                    <thead>
                        <tr>
                            <th>Detalle</th>
                            <th className="r">Cant.</th>
                            <th className="r">Vr. Unitario</th>
                            <th className="r">Vr. Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {remision.lines.map((l, i) => (
                            <tr key={i}>
                                <td>
                                    <div className="pubr-it-name">{l.name}</div>
                                    {l.description && <div className="pubr-it-desc">{l.description}</div>}
                                </td>
                                <td className="r">{l.quantity}</td>
                                <td className="r">{formatCOP(l.price)}</td>
                                <td className="r">{formatCOP(l.price * l.quantity)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {remision.notes && <p className="pubr-notas">{remision.notes}</p>}

                {/* Firma */}
                {yaFirmada ? (
                    <div className="pubr-signed">
                        <i className="ri-checkbox-circle-line"></i>
                        <div>
                            <strong>Entrega aceptada</strong>
                            <p>
                                Firmada por {remision.signed_by || remision.client_name}
                                {remision.signed_at ? ` el ${new Date(remision.signed_at).toLocaleString("es-CO")}` : ""}.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="pubr-sign-area">
                        <h3>Firma de recibido</h3>
                        <p className="pubr-sign-hint">Dibuja tu firma para confirmar que recibiste la entrega conforme.</p>
                        <div className="pubr-sign-name-field">
                            <FilterField label="Nombre de quien recibe" htmlFor="pubr-sign-name" icon="ri-user-line">
                                <FieldControl
                                    id="pubr-sign-name"
                                    type="text"
                                    placeholder="Nombre completo"
                                    value={signedBy}
                                    onChange={(e) => setSignedBy(e.target.value)}
                                    disabled={signing}
                                />
                            </FilterField>
                        </div>
                        <SignaturePad ref={padRef} height={220} disabled={signing} />
                        <div className="pubr-sign-actions">
                            <button type="button" className="btn-secondary pubr-btn" onClick={() => padRef.current?.clear()} disabled={signing}>
                                Limpiar
                            </button>
                            <button type="button" className="btn-primary pubr-btn" onClick={handleSign} disabled={signing}>
                                {signing ? "Firmando..." : "Firmar entrega"}
                            </button>
                        </div>
                    </div>
                )}

                <footer className="pubr-foot">
                    <button type="button" className="btn-secondary pubr-btn" onClick={handleDownload} disabled={downloading}>
                        <i className={downloading ? "ri-loader-4-line rotating" : "ri-download-line"}></i> Descargar PDF
                    </button>
                </footer>
            </div>
        </main>
    );
};

export default PublicRemision;
