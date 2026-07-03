import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import "./DocumentDetail.css";
import "../../accounting/page/Configuration.css"; // acc-card para el bloque de adjuntos
import Attachments from "../../../components/shared/Attachments/Attachments";
import type { Factura, TipoDocElectronico, DIANCompleteResponse, DIANIndicadorProceso, DIANNovedad, DIANMessage } from "../../../types";
import { downloadInvoiceById, discardDraftInvoice, getInvoiceById, resendInvoiceEmail, submitDraftInvoice } from "../../../services/invoices.service";
import { PATHS } from "../../../router/paths.contants";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";

/** Tiempo tras la fecha/hora de emisión antes de permitir descarga PDF / impresión (evita PDF aún no generado). */
const PDF_ACTIONS_DELAY_MS = 30 * 1000;

const RESEND_INVOICE_EMAIL_MODAL_MESSAGE = `Estás a punto de reenviar una factura al cliente ...

Nota importante: Este correo corresponde al reenvío de una factura previamente emitida. No se trata de una nueva factura ni genera una nueva obligación de pago adicional.`;

function getEmissionTimeMs(factura: Factura): number | null {
    const raw = factura.Encabezado?.FechaYHoraDocumento ?? factura.Encabezado?.FechaYHoraEmision;
    if (raw == null || raw === "") return null;
    const d = raw instanceof Date ? raw : new Date(String(raw));
    const t = d.getTime();
    return Number.isNaN(t) ? null : t;
}

const DocumentDetailPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [factura, setFactura] = useState<Factura | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [pdfCooldownTick, setPdfCooldownTick] = useState(0);
    const [resendEmailModalOpen, setResendEmailModalOpen] = useState(false);
    const [resendingEmail, setResendingEmail] = useState(false);
    const [submitDraftModalOpen, setSubmitDraftModalOpen] = useState(false);
    const [submittingDraft, setSubmittingDraft] = useState(false);
    const [discardDraftModalOpen, setDiscardDraftModalOpen] = useState(false);
    const [discardingDraft, setDiscardingDraft] = useState(false);

    const isDraft = !!factura?.systemInfo?.is_draft;

    useEffect(() => {
        if (!factura) return;
        const t0 = getEmissionTimeMs(factura);
        if (t0 === null) return;
        const until = t0 + PDF_ACTIONS_DELAY_MS;
        if (Date.now() >= until) return;
        const id = window.setInterval(() => setPdfCooldownTick((n) => n + 1), 1000);
        return () => clearInterval(id);
    }, [factura]);

    const { pdfActionsBlocked, pdfCooldownSecondsRemaining } = useMemo(() => {
        if (!factura) {
            return { pdfActionsBlocked: false, pdfCooldownSecondsRemaining: 0 };
        }
        const t0 = getEmissionTimeMs(factura);
        if (t0 === null) {
            return { pdfActionsBlocked: false, pdfCooldownSecondsRemaining: 0 };
        }
        const until = t0 + PDF_ACTIONS_DELAY_MS;
        const remainingMs = Math.max(0, until - Date.now());
        void pdfCooldownTick;
        return {
            pdfActionsBlocked: remainingMs > 0,
            pdfCooldownSecondsRemaining: Math.ceil(remainingMs / 1000),
        };
    }, [factura, pdfCooldownTick]);

    // Cargar factura por ID
    useEffect(() => {
        const loadInvoice = async () => {
            if (!id) {
                errorToast("ID de factura no válido");
                navigate(-1);
                return;
            }

            setLoading(true);
            try {
                const response = await getInvoiceById(id);
                setFactura(response?.factura || null);
            } catch (error: any) {
                errorToast(error.message);
                navigate(-1);
            } finally {
                setLoading(false);
            }
        };

        loadInvoice();
    }, [id, navigate]);

    // Funciones de formateo
    const getTipoDocumento = (tipo: TipoDocElectronico | string) => {
        const tipos: Record<string, string> = {
            "01": "Factura Electrónica",
            "1": "Factura Electrónica",
            "02": "Nota Débito",
            "2": "Nota Débito",
            "03": "Nota Crédito",
            "3": "Nota Crédito",
        };
        return tipos[tipo] || "Documento Electrónico";
    };

    const getStatusLabel = (status: string) => {
        if (isDraft) return "Borrador";
        switch (status) {
            case "APPROVED":
                return "Aprobada";
            case "PENDING":
                return "Pendiente";
            case "REJECTED":
                return "Rechazada";
            default:
                return status;
        }
    };

    const getStatusClass = (status: string) => {
        if (isDraft) return "status-borrador";
        switch (status) {
            case "APPROVED":
                return "status-pagada";
            case "PENDING":
                return "status-pendiente";
            case "REJECTED":
                return "status-rechazada";
            default:
                return "";
        }
    };

    const formatPrice = (price: number | string, currencyParam: any) => {
        // Convertir a número si viene como string
        const numericPrice = typeof price === "string" ? parseFloat(price) : price;

        // Si el precio no es válido, retornar N/A
        if (isNaN(numericPrice)) {
            return "N/A";
        }

        const currencyCode = typeof currencyParam === "string" ? currencyParam : currencyParam?.Value || "COP";

        // Usar toLocaleString para ser receptivo a cualquier moneda
        const localeMap: Record<string, string> = {
            COP: "es-CO",
            USD: "en-US",
            EUR: "es-ES",
            MXN: "es-MX",
            ARS: "es-AR",
            CAD: "en-CA",
            GBP: "en-GB",
        };

        const locale = localeMap[currencyCode] || "es-CO";

        return numericPrice.toLocaleString(locale, {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("es-CO", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const getPdfBlob = async () => {
        if (!id) {
            throw new Error("ID de factura no válido");
        }

        const response = await downloadInvoiceById(id);
        if (!response?.ok) {
            throw new Error("La API de descarga respondió sin confirmar éxito");
        }
        const base64 = response?.base64_factura;
        const mimeType = response?.mime_type || "application/pdf";

        if (!base64) {
            throw new Error("La factura no trae base64");
        }
        if (mimeType !== "application/pdf") {
            throw new Error(`Tipo MIME inválido para PDF: ${mimeType}`);
        }

        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return {
            blob: new Blob([bytes], { type: mimeType }),
            fileName: response?.file_name || `factura-${id}.pdf`,
        };
    };

    const handleDownloadPdf = async () => {
        if (!id || downloadingPdf || pdfActionsBlocked) {
            return;
        }

        setDownloadingPdf(true);
        try {
            const { blob, fileName } = await getPdfBlob();
            const url = URL.createObjectURL(blob);

            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);

            URL.revokeObjectURL(url);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "No se pudo descargar la factura";
            errorToast(message);
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handlePrintPdf = async () => {
        if (!id || downloadingPdf || pdfActionsBlocked) {
            return;
        }

        setDownloadingPdf(true);
        try {
            const { blob } = await getPdfBlob();
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, "_blank");

            if (!printWindow) {
                URL.revokeObjectURL(url);
                throw new Error("No se pudo abrir la ventana de impresión. Revisa si el navegador bloqueó el popup.");
            }

            printWindow.addEventListener("load", () => {
                printWindow.focus();
                printWindow.print();
            });

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 60000);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "No se pudo imprimir la factura";
            errorToast(message);
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleOpenResendEmailModal = () => {
        if (!id || pdfActionsBlocked) return;
        setResendEmailModalOpen(true);
    };

    const handleConfirmResendEmail = async () => {
        if (!id) return;
        setResendingEmail(true);
        try {
            const res = await resendInvoiceEmail(id);
            successToast(res?.message?.trim() || "Correo reenviado correctamente.");
            setResendEmailModalOpen(false);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "No se pudo reenviar el correo");
        } finally {
            setResendingEmail(false);
        }
    };

    const handleConfirmSubmitDraft = async () => {
        if (!id) return;
        setSubmittingDraft(true);
        try {
            const res = await submitDraftInvoice(id);
            successToast(res?.message?.trim() || "Borrador enviado a la DIAN correctamente.");
            setSubmitDraftModalOpen(false);
            if (res?.factura) {
                setFactura(res.factura);
            } else {
                const response = await getInvoiceById(id);
                setFactura(response?.factura || null);
            }
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "No se pudo enviar el borrador a la DIAN");
        } finally {
            setSubmittingDraft(false);
        }
    };

    const handleConfirmDiscardDraft = async () => {
        if (!id) return;
        setDiscardingDraft(true);
        try {
            const res = await discardDraftInvoice(id);
            successToast(res?.message?.trim() || "Borrador descartado.");
            setDiscardDraftModalOpen(false);
            navigate(PATHS.DOCUMENTS);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "No se pudo descartar el borrador");
        } finally {
            setDiscardingDraft(false);
        }
    };

    const handleNavigateToNota = (option: "credito" | "debito") => {
        if (!factura) return;
        const ref = factura.systemInfo?.dianDocKey?.trim();
        if (!ref) {
            errorToast("No se encontró la referencia DIAN del documento (dianDocKey).");
            return;
        }
        // El widget de facturación (DASHBOARD_BILLING = /facturar) es el que procesa is_nota.
        navigate(PATHS.DASHBOARD_BILLING, {
            state: {
                is_nota: { option, ref },
            },
        });
    };

    if (loading) {
        return (
            <main className="document-detail-page">
                <div className="document-detail-container">
                    <div style={{ textAlign: "center", padding: "40px" }}>
                        <p>Cargando factura...</p>
                    </div>
                </div>
            </main>
        );
    }

    if (!factura) {
        return null;
    }

    // Datos del cliente (Receptor)
    const clientName = factura.Terceros?.TerceroClienteContable?.Tercero?.NombreTercero?.[0]?.Value || "N/A";
    const clientDocNumber = factura.Terceros?.TerceroClienteContable?.Tercero?.IdTercero?.[0]?.Value || "N/A";
    const clientNivelTributario = factura.Terceros?.TerceroClienteContable?.Tercero?.EsquemaTributarioTercero?.[0]?.NivelTributario?.Value || "";
    const clientEsquemaTributario = factura.Terceros?.TerceroClienteContable?.Tercero?.EsquemaTributarioTercero?.[0]?.EsquemaTributario?.Nombre?.Value || "";

    // Datos de la empresa (Emisor)
    const companyName = factura.Terceros?.TerceroProveedorContable?.Tercero?.NombreTercero?.[0]?.Value || "N/A";
    const companyDocNumber = factura.Terceros?.TerceroProveedorContable?.Tercero?.IdTercero?.[0]?.Value || "N/A";
    const companyAddress = factura.Terceros?.TerceroProveedorContable?.Tercero?.UbicacionFisica?.Direccion?.LineaDireccion?.[0]?.TextoLinea?.Value || "";
    const companyCity = factura.Terceros?.TerceroProveedorContable?.Tercero?.UbicacionFisica?.Direccion?.Ciudad?.Value || "";
    const companyDepartamento = factura.Terceros?.TerceroProveedorContable?.Tercero?.UbicacionFisica?.Direccion?.Departamento?.Value || "";

    // Medio de pago
    const medioDePago = factura.AgregadoComercial?.MediosDePago?.[0]?.CodigoMedioDePago?.Value;
    const medioDePagoLabel = medioDePago === "1" ? "Contado" : medioDePago === "2" ? "Crédito" : "N/A";
    const fechaLimitePago = factura.AgregadoComercial?.MediosDePago?.[0]?.FechaLimitePago;

    // Moneda
    const currency = factura.Totales?.TotalMonetario?.ValorAPagar?.IdMoneda || "COP";

    return (
        <main className="document-detail-page">
            <div className="document-detail-container">
                <div className="detail-header">
                    <button
                        className="btn-back"
                        onClick={() => navigate(-1)}
                    >
                        <i className="ri-arrow-left-line"></i>
                        Volver
                    </button>
                    <div className="detail-actions">
                        {!isDraft && pdfActionsBlocked && (
                            <span
                                className="detail-actions-pdf-wait"
                                role="status"
                                aria-live="polite"
                            >
                                Descarga, impresión y envío por correo disponibles en <strong className="detail-actions-pdf-wait-seconds">{pdfCooldownSecondsRemaining}s</strong>
                            </span>
                        )}
                        {/* Borrador: el PDF es solo una previsualización (sin validación DIAN). No aplica cooldown. */}
                        <button
                            className="btn-secondary"
                            onClick={handleDownloadPdf}
                            disabled={downloadingPdf || (!isDraft && pdfActionsBlocked)}
                            title={!isDraft && pdfActionsBlocked ? `Espera ${pdfCooldownSecondsRemaining}s desde la emisión del documento` : undefined}
                        >
                            <i className="ri-download-line"></i>
                            {downloadingPdf ? "Descargando..." : isDraft ? "Descargar PDF (Previsualización)" : "Descargar PDF"}
                        </button>

                        {isDraft ? (
                            <>
                                <button
                                    type="button"
                                    className="btn-success"
                                    onClick={() => setSubmitDraftModalOpen(true)}
                                    disabled={submittingDraft || discardingDraft}
                                >
                                    <i className="ri-send-plane-line"></i>
                                    Enviar a la DIAN
                                </button>
                                <button
                                    type="button"
                                    className="btn-danger"
                                    onClick={() => setDiscardDraftModalOpen(true)}
                                    disabled={submittingDraft || discardingDraft}
                                >
                                    <i className="ri-delete-bin-line"></i>
                                    Borrar borrador
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    className="btn-secondary"
                                    onClick={handlePrintPdf}
                                    disabled={downloadingPdf || pdfActionsBlocked}
                                    title={pdfActionsBlocked ? `Espera ${pdfCooldownSecondsRemaining}s desde la emisión del documento` : undefined}
                                >
                                    <i className="ri-printer-line"></i>
                                    {downloadingPdf ? "Preparando..." : "Imprimir"}
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={pdfActionsBlocked}
                                    title={pdfActionsBlocked ? `Espera ${pdfCooldownSecondsRemaining}s desde la emisión del documento` : undefined}
                                    onClick={handleOpenResendEmailModal}
                                >
                                    <i className="ri-mail-line"></i>
                                    Enviar por Email
                                </button>
                                <button
                                    type="button"
                                    className="btn-warning"
                                    onClick={() => handleNavigateToNota("debito")}
                                >
                                    <i className="ri-file-text-line"></i>
                                    Generar Nota Débito
                                </button>
                                <button
                                    type="button"
                                    className="btn-success"
                                    onClick={() => handleNavigateToNota("credito")}
                                >
                                    <i className="ri-file-check-line"></i>
                                    Generar Nota Crédito
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="document-card">
                    <div className="document-card-header">
                        {factura.Parametros?.TipoAmbiente === "2" && <span className="test-badge">DOCUMENTO EMITIDO EN MODO DE PRUEBA</span>}
                        <div>
                            <h1>{getTipoDocumento(factura.Encabezado?.TipoDocElectronico || "01")}</h1>
                            <p className="document-number">
                                {/* Los borradores no reservan consecutivo: se asigna al enviar. */}
                                {factura.Encabezado?.NumeroDocumento
                                    ? `${factura.Encabezado?.PrefijoDocumento || "DOC"}-${factura.Encabezado?.NumeroDocumento}`
                                    : `${factura.Encabezado?.PrefijoDocumento || "DOC"} · por asignar`}
                            </p>
                        </div>
                        <span className={`status-badge ${getStatusClass(factura.systemInfo?.facturaStatus || "PENDING")}`}>{getStatusLabel(factura.systemInfo?.facturaStatus || "PENDING")}</span>
                    </div>

                    <div className="document-info-grid">
                        <div className="info-section">
                            <h3>Información de la Empresa (Emisor)</h3>
                            <div className="info-content">
                                <p>
                                    <strong>{companyName}</strong>
                                </p>
                                <p>NIT: {companyDocNumber}</p>
                                {companyAddress && <p>{companyAddress}</p>}
                                {companyCity && (
                                    <p>
                                        {companyCity}
                                        {companyDepartamento ? `, ${companyDepartamento}` : ""}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="info-section">
                            <h3>Información del Cliente (Receptor)</h3>
                            <div className="info-content">
                                <p>
                                    <strong>{clientName}</strong>
                                </p>
                                <p>Documento: {clientDocNumber}</p>
                                {clientNivelTributario && <p>Nivel Tributario: {clientNivelTributario}</p>}
                                {clientEsquemaTributario && <p>Régimen: {clientEsquemaTributario}</p>}
                            </div>
                        </div>

                        <div className="info-section">
                            <h3>Información del Documento</h3>
                            <div className="info-content">
                                {(factura.Encabezado?.FechaYHoraDocumento || factura.Encabezado?.FechaYHoraEmision) && (
                                    <p>
                                        <strong>Fecha de Emisión:</strong>{" "}
                                        {formatDate(
                                            (() => {
                                                const f = factura.Encabezado!.FechaYHoraDocumento || factura.Encabezado!.FechaYHoraEmision || "";
                                                return f instanceof Date ? f.toISOString() : String(f);
                                            })(),
                                        )}
                                    </p>
                                )}
                                <p>
                                    <strong>Estado Factura:</strong> {getStatusLabel(factura.systemInfo?.facturaStatus || "PENDING")}
                                </p>
                                <p>
                                    <strong>Estado DIAN:</strong> {factura.systemInfo?.dianStatusDescr ? "Procesado" : "Pendiente"}
                                </p>
                            </div>
                        </div>

                        <div className="info-section">
                            <h3>Información de Pago</h3>
                            <div className="info-content">
                                <p>
                                    <strong>Medio de Pago:</strong> {medioDePagoLabel}
                                </p>
                                {fechaLimitePago && medioDePago === "2" && (
                                    <p>
                                        <strong>Fecha Límite:</strong> {formatDate(fechaLimitePago)}
                                    </p>
                                )}
                                <p>
                                    <strong>Moneda:</strong> {typeof currency === "string" ? currency : ((currency as { Value?: string })?.Value ?? "COP")}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="items-section">
                        <h3>Detalles de Productos/Servicios</h3>
                        <table className="items-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Descripción</th>
                                    <th>Cantidad</th>
                                    <th>Precio Unitario</th>
                                    <th>IVA</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {factura.Lineas?.map((linea) => {
                                    const lineImpuestos = linea?.TotalImpuesto ?? linea?.TotalImpusto;
                                    const ivaPercent = lineImpuestos?.[0]?.SubTotalImpuesto?.[0]?.CategoriaImpuesto?.Porcentaje ?? 0;

                                    return (
                                        <tr key={linea?.Id?.Value || Math.random()}>
                                            <td>{linea?.Id?.Value || "-"}</td>
                                            <td>
                                                <strong>{linea?.Item?.Nombre?.Value || "Sin nombre"}</strong>
                                                {linea?.Item?.Descripcion && linea.Item.Descripcion[0]?.Value && <div style={{ fontSize: "0.875rem", color: "#666" }}>{linea.Item.Descripcion[0].Value}</div>}
                                            </td>
                                            <td>{linea?.Cantidad?.Value || 0}</td>
                                            <td>{linea?.Item?.Precio?.ValorPrecio ? formatPrice(linea.Item.Precio.ValorPrecio.Value, linea.Item.Precio.ValorPrecio.IdMoneda) : "N/A"}</td>
                                            <td>{String(ivaPercent)}%</td>
                                            <td>{linea?.ValorNeto ? formatPrice(linea.ValorNeto.Value, linea.ValorNeto.IdMoneda) : "N/A"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="items-cards">
                            {factura.Lineas?.map((linea) => {
                                const lineImpuestos = linea?.TotalImpuesto ?? linea?.TotalImpusto;
                                const ivaPercent = lineImpuestos?.[0]?.SubTotalImpuesto?.[0]?.CategoriaImpuesto?.Porcentaje ?? 0;

                                return (
                                    <article
                                        className="item-card"
                                        key={`card-${linea?.Id?.Value || Math.random()}`}
                                    >
                                        <div className="item-card__row">
                                            <span className="item-card__label">#</span>
                                            <span className="item-card__value">{linea?.Id?.Value || "-"}</span>
                                        </div>
                                        <div className="item-card__row item-card__row--column">
                                            <span className="item-card__label">Descripcion</span>
                                            <span className="item-card__value">
                                                <strong>{linea?.Item?.Nombre?.Value || "Sin nombre"}</strong>
                                                {linea?.Item?.Descripcion && linea.Item.Descripcion[0]?.Value && <small className="item-card__description">{linea.Item.Descripcion[0].Value}</small>}
                                            </span>
                                        </div>
                                        <div className="item-card__row">
                                            <span className="item-card__label">Cantidad</span>
                                            <span className="item-card__value">{linea?.Cantidad?.Value || 0}</span>
                                        </div>
                                        <div className="item-card__row">
                                            <span className="item-card__label">Precio Unitario</span>
                                            <span className="item-card__value">{linea?.Item?.Precio?.ValorPrecio ? formatPrice(linea.Item.Precio.ValorPrecio.Value, linea.Item.Precio.ValorPrecio.IdMoneda) : "N/A"}</span>
                                        </div>
                                        <div className="item-card__row">
                                            <span className="item-card__label">IVA</span>
                                            <span className="item-card__value">{String(ivaPercent)}%</span>
                                        </div>
                                        <div className="item-card__row">
                                            <span className="item-card__label">Total</span>
                                            <span className="item-card__value">{linea?.ValorNeto ? formatPrice(linea.ValorNeto.Value, linea.ValorNeto.IdMoneda) : "N/A"}</span>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>

                    <div className="totals-section">
                        <h3>Resumen de Totales</h3>

                        {factura.Totales?.TotalMonetario?.ValorBruto && (
                            <div className="totals-row">
                                <span>Subtotal (Valor Bruto):</span>
                                <span>{formatPrice(factura.Totales.TotalMonetario.ValorBruto.Value, factura.Totales.TotalMonetario.ValorBruto.IdMoneda)}</span>
                            </div>
                        )}

                        {factura.Totales?.TotalMonetario?.ValorBaseImpuestos && (
                            <div className="totals-row">
                                <span>Base Gravable (Impuestos):</span>
                                <span>{formatPrice(factura.Totales.TotalMonetario.ValorBaseImpuestos.Value, factura.Totales.TotalMonetario.ValorBaseImpuestos.IdMoneda)}</span>
                            </div>
                        )}

                        {/* Mostrar cada impuesto */}
                        {factura.Totales?.TotalImpuestos && factura.Totales.TotalImpuestos.length > 0 && (
                            <>
                                <div className="totals-divider"></div>
                                <div className="totals-subtitle">Impuestos:</div>
                                {factura.Totales.TotalImpuestos.map((impuesto: any, index: number) =>
                                    impuesto?.SubTotalImpuesto?.map((subTotal: any, subIndex: number) => (
                                        <div
                                            key={`${index}-${subIndex}`}
                                            className="totals-row tax-row"
                                        >
                                            <span>
                                                {subTotal?.CategoriaImpuesto?.EsquemaTributario?.Nombre?.Value || "Impuesto"}({subTotal?.CategoriaImpuesto?.Porcentaje || "0"}%)
                                            </span>
                                            <span>{formatPrice(subTotal?.ValorImpuesto?.Value || 0, subTotal?.ValorImpuesto?.IdMoneda || currency)}</span>
                                        </div>
                                    )),
                                )}
                            </>
                        )}

                        {factura.Totales?.TotalMonetario?.TotalMasImpuestos && (
                            <div className="totals-row">
                                <span>Total con Impuestos:</span>
                                <span>{formatPrice(factura.Totales.TotalMonetario.TotalMasImpuestos.Value, factura.Totales.TotalMonetario.TotalMasImpuestos.IdMoneda)}</span>
                            </div>
                        )}

                        {factura.Totales?.TotalMonetario?.ValorAPagar && (
                            <div className="totals-row total">
                                <span>
                                    <strong>Total a Pagar:</strong>
                                </span>
                                <span>
                                    <strong>{formatPrice(factura.Totales.TotalMonetario.ValorAPagar.Value, factura.Totales.TotalMonetario.ValorAPagar.IdMoneda)}</strong>
                                </span>
                            </div>
                        )}
                    </div>

                    {factura.Notas && factura.Notas.length > 0 && (
                        <div className="notes-section">
                            <h3>Observaciones</h3>
                            {factura.Notas.map((nota, index) => nota?.Value && <p key={index}>{nota.Value}</p>)}
                        </div>
                    )}

                    {/* DIAN Response Section */}
                    {factura.systemInfo?.dianCompleteResponse &&
                        (() => {
                            const dian = factura.systemInfo.dianCompleteResponse as DIANCompleteResponse;
                            return (
                                <div className="dian-response-section">
                                    <h3>Respuesta de la DIAN</h3>

                                    {/* Validation Status */}
                                    <div className="validation-status-card">
                                        <div className={`validation-status ${dian.RespuestaUnitaria.EncabezadoRespuesta.SolicitudAceptada ? "accepted" : "rejected"}`}>
                                            <i className={`ri-${dian.RespuestaUnitaria.EncabezadoRespuesta.SolicitudAceptada ? "checkbox-circle" : "close-circle"}-line`}></i>
                                            <span>{dian.RespuestaUnitaria.EncabezadoRespuesta.SolicitudAceptada ? "Documento Aceptado" : "Documento Rechazado"}</span>
                                        </div>
                                        <div className="validation-meta">
                                            <p>
                                                <strong>Fecha de Respuesta:</strong> {new Date(dian.DatosDeControl.FechaRespuesta).toLocaleString("es-CO")}
                                            </p>
                                            <p>
                                                <strong>Documento Válido:</strong> {dian.RespuestaUnitaria.DocElectronicoExtendido.DocumentoValido ? "Sí" : "No"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Process Indicators */}
                                    {dian.RespuestaUnitaria.EncabezadoRespuesta.EstadosGenerales?.IndicadorProceso && (
                                        <div className="process-indicators">
                                            <h4>Indicadores de Proceso</h4>
                                            <div className="indicators-grid">
                                                {dian.RespuestaUnitaria.EncabezadoRespuesta.EstadosGenerales.IndicadorProceso.map((indicator: DIANIndicadorProceso, index: number) => (
                                                    <div
                                                        key={index}
                                                        className={`indicator-badge ${indicator.Value ? "active" : "inactive"}`}
                                                    >
                                                        <i className={`ri-${indicator.Value ? "checkbox-circle" : "close-circle"}-line`}></i>
                                                        <span>{indicator.Nombre.replace("IND_", "").replace(/_/g, " ")}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary Text */}
                                    {dian.RespuestaUnitaria.EncabezadoRespuesta.TextoResumenCorto && (
                                        <div className="response-summary">
                                            <h4>Resumen de Validación</h4>
                                            <pre>{dian.RespuestaUnitaria.EncabezadoRespuesta.TextoResumenCorto}</pre>
                                        </div>
                                    )}

                                    {/* Validation Messages (Novedades) */}
                                    {dian.RespuestaUnitaria.EncabezadoRespuesta.Novedad && dian.RespuestaUnitaria.EncabezadoRespuesta.Novedad.length > 0 && (
                                        <div className="validation-messages">
                                            <h4>Mensajes de Validación</h4>
                                            {dian.RespuestaUnitaria.EncabezadoRespuesta.Novedad.map((novedad: DIANNovedad, index: number) => (
                                                <div
                                                    key={index}
                                                    className={`novedad-card ${novedad.IndicaFallo ? "error" : "warning"}`}
                                                >
                                                    <div className="novedad-header">
                                                        <span className="novedad-type">
                                                            <i className={`ri-${novedad.IndicaFallo ? "error-warning" : "information"}-line`}></i>
                                                            {novedad.TipoLogCodigo}
                                                        </span>
                                                        <span className="novedad-count">{novedad.CantMensajes} mensaje(s)</span>
                                                    </div>
                                                    <p className="novedad-description">{novedad.TipoLogTexto}</p>
                                                    {novedad.Mensaje && novedad.Mensaje.length > 0 && (
                                                        <div className="message-list">
                                                            {novedad.Mensaje.map((mensaje: DIANMessage, msgIndex: number) => (
                                                                <div
                                                                    key={msgIndex}
                                                                    className="message-item"
                                                                >
                                                                    <span className="message-number">#{mensaje.Nro}</span>
                                                                    <div className="message-content">
                                                                        <strong>{mensaje.Tipo}</strong>
                                                                        <p>{mensaje.Value}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {novedad.Adicional && (
                                                        <p className="novedad-additional">
                                                            <small>Proceso: {novedad.Adicional}</small>
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Critical Summary */}
                                    {dian.RespuestaUnitaria.EncabezadoRespuesta.TextoResumenNovsCrit && (
                                        <div className="critical-summary">
                                            <h4>Resumen de Novedades Críticas</h4>
                                            <pre>{dian.RespuestaUnitaria.EncabezadoRespuesta.TextoResumenNovsCrit}</pre>
                                        </div>
                                    )}

                                    {/* Tracking Code */}
                                    <div className="tracking-info">
                                        <p>
                                            <strong>Código de Rastreo:</strong>
                                        </p>
                                        <code className="tracking-code">{dian.DatosDeControl.CodigoRastreo}</code>
                                    </div>
                                </div>
                            );
                        })()}
                </div>
            </div>
            {id && (
                <div className="acc-card" style={{ marginTop: 16 }}>
                    <Attachments entidad="factura" entidadId={id} titulo="Soportes de la factura" />
                </div>
            )}
            <ConfirmModal
                isOpen={resendEmailModalOpen}
                onClose={() => {
                    if (!resendingEmail) setResendEmailModalOpen(false);
                }}
                onConfirm={() => void handleConfirmResendEmail()}
                title="Reenviar factura por correo"
                message={RESEND_INVOICE_EMAIL_MODAL_MESSAGE}
                confirmText="Confirmar"
                cancelText="Cancelar"
                type="info"
                loading={resendingEmail}
            />
            <ConfirmModal
                isOpen={submitDraftModalOpen}
                onClose={() => {
                    if (!submittingDraft) setSubmitDraftModalOpen(false);
                }}
                onConfirm={() => void handleConfirmSubmitDraft()}
                title="Enviar borrador a la DIAN"
                message="Vas a emitir definitivamente este borrador y enviarlo a la DIAN. Una vez emitido no podrá editarse ni eliminarse. ¿Deseas continuar?"
                confirmText="Enviar a la DIAN"
                cancelText="Cancelar"
                type="info"
                loading={submittingDraft}
            />
            <ConfirmModal
                isOpen={discardDraftModalOpen}
                onClose={() => {
                    if (!discardingDraft) setDiscardDraftModalOpen(false);
                }}
                onConfirm={() => void handleConfirmDiscardDraft()}
                title="Borrar borrador"
                message="Vas a eliminar permanentemente este borrador. Esta acción no se puede deshacer. ¿Deseas continuar?"
                confirmText="Borrar borrador"
                cancelText="Cancelar"
                type="danger"
                loading={discardingDraft}
            />
        </main>
    );
};

export default DocumentDetailPage;
