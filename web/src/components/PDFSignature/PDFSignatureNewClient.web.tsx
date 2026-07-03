import React, { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import SignatureCanvas from "react-signature-canvas";
import { PDFDocument } from "pdf-lib";
import toast from "react-hot-toast";
import "./PDFSignature.css";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PDFSignatureNewProps {
  pdfUrl: string;
  onSigned: (signedPdfFile: File) => void;
}

const SIGNATURE_WIDTH = 150;

export const PDFSignatureNewClient: React.FC<PDFSignatureNewProps> = ({ pdfUrl, onSigned }) => {
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureDrawn, setSignatureDrawn] = useState(false);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string>("");

  const [numPages, setNumPages] = useState<number>(0);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [pdfPageWidth, setPdfPageWidth] = useState<number>(0);
  const [pdfPageHeight, setPdfPageHeight] = useState<number>(0);
  const [renderedPageWidth, setRenderedPageWidth] = useState<number>(0);
  const [renderedPageHeight, setRenderedPageHeight] = useState<number>(0);

  const [isSignaturePlaced, setIsSignaturePlaced] = useState(false);
  const [signaturePosition, setSignaturePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  const signatureRef = useRef<SignatureCanvas>(null);
  useBodyScrollLock(showSignatureModal);

  useEffect(() => {
    if (showSignatureModal) {
      if (!signedPdfBlob) {
        setSignatureDrawn(false);
        setSignatureImageUrl("");
        setIsSignaturePlaced(false);
        setPdfLoadError(null);
      }
    }
  }, [showSignatureModal, signedPdfBlob]);

  useEffect(() => {
    return () => {
      if (signedPdfUrl) {
        URL.revokeObjectURL(signedPdfUrl);
      }
    };
  }, [signedPdfUrl]);

  const onDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setPdfLoadError(null);
    setNumPages(pages);
    if (!signedPdfBlob && pages >= 2) {
      setSelectedPage(2);
    } else {
      setSelectedPage(1);
    }
  };

  const onDocumentLoadError = (error: Error) => {
    const msg = error?.message ?? String(error);
    const is401 = /401|unauthorized|Unauthorized/.test(msg);
    console.error("[PDFSignature] Error al cargar el PDF:", msg, error);
    if (is401) {
      setPdfLoadError(
        "Tu sesión expiró o el enlace ya no es válido. Por favor abre de nuevo el enlace que te enviamos por correo para firmar el contrato."
      );
      toast.error("Sesión expirada. Usa el enlace del correo de nuevo.");
    } else {
      setPdfLoadError(
        "No se pudo cargar el PDF. Puede deberse a sesión expirada (usa el enlace del correo de nuevo), CORS o a que la URL del documento ya no es válida."
      );
      toast.error("No se pudo cargar el documento PDF");
    }
  };

  const onPageLoadSuccess = (page: { originalWidth: number; originalHeight: number; width: number; height: number }) => {
    setPdfPageWidth(page.originalWidth);
    setPdfPageHeight(page.originalHeight);
    setRenderedPageWidth(page.width);
    setRenderedPageHeight(page.height);
  };

  const clearSignature = () => {
    signatureRef.current?.clear();
    setSignatureDrawn(false);
    setSignatureImageUrl("");
  };

  const confirmSignatureDrawing = () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast.error("Por favor dibuja tu firma primero");
      return;
    }

    const imageUrl = signatureRef.current.toDataURL("image/png");
    setSignatureImageUrl(imageUrl);
    setSignatureDrawn(true);
    toast.success("Ahora haz CLICK en el documento para colocar tu firma");
  };

  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signatureDrawn || !signatureImageUrl || isSigning || isSignaturePlaced || signedPdfBlob) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const estimatedHeight = SIGNATURE_WIDTH / 2;

    setSignaturePosition({
      x: clickX - SIGNATURE_WIDTH / 2,
      y: clickY - estimatedHeight / 2,
    });
    setIsSignaturePlaced(true);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const containerRect = e.currentTarget.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffset.x;
    const newY = e.clientY - containerRect.top - dragOffset.y;

    setSignaturePosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const confirmPlacement = async () => {
    setIsSigning(true);
    try {
      const response = await fetch(pdfUrl);
      const pdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const signatureImageBytes = await fetch(signatureImageUrl).then((res) => res.arrayBuffer());
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

      const scaleX = pdfPageWidth / renderedPageWidth;
      const scaleY = pdfPageHeight / renderedPageHeight;

      const pdfX = signaturePosition.x * scaleX;
      const pdfYTop = signaturePosition.y * scaleY;

      const targetWidth = SIGNATURE_WIDTH * scaleX;
      const targetHeight = (targetWidth / signatureImage.width) * signatureImage.height;

      const y = pdfPageHeight - (pdfYTop + targetHeight);
      const x = pdfX;

      const pages = pdfDoc.getPages();
      const page = pages[selectedPage - 1];

      page.drawImage(signatureImage, {
        x,
        y,
        width: targetWidth,
        height: targetHeight,
      });

      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      setSignedPdfBlob(blob);
      setSignedPdfUrl(blobUrl);

      const file = new File([blob], "contrato_mandato_firmado.pdf", { type: "application/pdf" });
      onSigned(file);

      toast.success("¡Documento firmado exitosamente!");
    } catch (error) {
      console.error("Error signing PDF:", error);
      toast.error("Error al firmar el documento");
    } finally {
      setIsSigning(false);
    }
  };

  const cancelPlacement = () => {
    setIsSignaturePlaced(false);
    setSignaturePosition({ x: 0, y: 0 });
  };

  const downloadSignedPDF = () => {
    if (signedPdfBlob) {
      const url = URL.createObjectURL(signedPdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "contrato_mandato_firmado.pdf";
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="pdf-signature-container">
      <div className="pdf-actions-main">
        {!signedPdfBlob ? (
          <button type="button" className="btn-primary btn-lg" onClick={() => setShowSignatureModal(true)}>
            <i className="ri-quill-pen-line"></i>
            Firmar Documento
          </button>
        ) : (
          <>
            <div className="success-badge">
              <i className="ri-checkbox-circle-fill"></i>
              Documento Firmado Exitosamente
            </div>
            <div className="signed-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowSignatureModal(true)}>
                <i className="ri-eye-line"></i>
                Ver Documento Firmado
              </button>
              <button type="button" className="btn-success" onClick={downloadSignedPDF}>
                <i className="ri-download-line"></i>
                Descargar PDF
              </button>
            </div>
          </>
        )}
      </div>

      {showSignatureModal && (
        <div className="signature-modal-overlay" onClick={() => setShowSignatureModal(false)}>
          <div className="signature-modal-fullscreen" onClick={(e) => e.stopPropagation()}>
            <div className="signature-modal-header">
              <h3>{signedPdfBlob ? "Documento Firmado" : "Revisar y Firmar Contrato"}</h3>
              <button type="button" className="close-btn" onClick={() => setShowSignatureModal(false)}>
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="signature-modal-body">
              <div className="pdf-column">
                <div className="pdf-preview-scrollable">
                  {pdfLoadError ? (
                    <div className="pdf-error pdf-loading-state">
                      <i className="ri-file-damage-line"></i>
                      <p>{pdfLoadError}</p>
                      <small>Revisa la consola del navegador (F12) para más detalles.</small>
                    </div>
                  ) : (
                    <Document
                      file={signedPdfUrl ?? pdfUrl}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={onDocumentLoadError}
                      loading={
                        <div className="loading-spinner">
                          <i className="ri-loader-4-line rotating"></i> Cargando PDF...
                        </div>
                      }
                    >
                      <div
                        className={`pdf-page-container ${isSigning ? "signing" : ""}`}
                        onClick={handlePdfClick}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{
                          cursor:
                            isSignaturePlaced || signedPdfBlob || !signatureDrawn
                              ? "default"
                              : `url(${signatureImageUrl}) 75 37, crosshair`,
                          position: "relative",
                        }}
                      >
                        <Page
                          pageNumber={selectedPage}
                          width={600}
                          onLoadSuccess={onPageLoadSuccess}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          className="pdf-page-canvas"
                        />

                        {isSignaturePlaced && !signedPdfBlob && (
                          <div
                            className={`draggable-signature-preview ${isDragging ? "dragging" : ""}`}
                            style={{
                              position: "absolute",
                              left: signaturePosition.x,
                              top: signaturePosition.y,
                              width: SIGNATURE_WIDTH,
                              height: "auto",
                              cursor: isDragging ? "grabbing" : "grab",
                              border: "2px dashed var(--primary-color)",
                              zIndex: 100,
                            }}
                            onMouseDown={handleMouseDown}
                          >
                            <img
                              src={signatureImageUrl}
                              alt="Firma"
                              style={{ width: "100%", display: "block", pointerEvents: "none" }}
                            />

                            <div className="signature-confirm-actions">
                              <button
                                className="btn-confirm-mini"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void confirmPlacement();
                                }}
                                title="Confirmar ubicación"
                              >
                                <i className="ri-check-line"></i>
                              </button>
                              <button
                                className="btn-cancel-mini"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelPlacement();
                                }}
                                title="Cancelar / Mover"
                              >
                                <i className="ri-close-line"></i>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </Document>
                  )}

                  {numPages > 1 && !pdfLoadError && (
                    <div className="page-controls">
                      <button
                        disabled={selectedPage <= 1}
                        onClick={() => {
                          setSelectedPage((p) => p - 1);
                          setIsSignaturePlaced(false);
                        }}
                        className="btn-icon"
                      >
                        <i className="ri-arrow-left-s-line"></i>
                      </button>
                      <span>
                        Página {selectedPage} de {numPages}
                      </span>
                      <button
                        disabled={selectedPage >= numPages}
                        onClick={() => {
                          setSelectedPage((p) => p + 1);
                          setIsSignaturePlaced(false);
                        }}
                        className="btn-icon"
                      >
                        <i className="ri-arrow-right-s-line"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="controls-column">
                {signedPdfBlob ? (
                  <div className="success-state">
                    <div className="success-icon-large">
                      <i className="ri-checkbox-circle-fill"></i>
                    </div>
                    <h4>¡Documento Firmado!</h4>
                    <p>El documento ha sido firmado correctamente. Puedes descargarlo o cerrar esta ventana.</p>
                    <button className="btn-success full-width" onClick={downloadSignedPDF}>
                      <i className="ri-download-line"></i> Descargar PDF
                    </button>
                    <button className="btn-secondary full-width" onClick={() => setShowSignatureModal(false)}>
                      Cerrar
                    </button>
                  </div>
                ) : !signatureDrawn ? (
                  <div className="drawing-controls">
                    <div className="step-badge">Paso 1</div>
                    <h4>Dibuja tu Firma</h4>
                    <p className="small-text">Dibuja tu firma en el recuadro de abajo.</p>

                    <div className="signature-pad-container">
                      <SignatureCanvas
                        ref={signatureRef}
                        canvasProps={{
                          className: "signature-canvas-sidebar",
                          width: 300,
                          height: 150,
                        }}
                      />
                    </div>

                    <div className="control-actions">
                      <button className="btn-secondary full-width" onClick={clearSignature}>
                        <i className="ri-eraser-line"></i> Limpiar
                      </button>
                      <button className="btn-primary full-width" onClick={confirmSignatureDrawing}>
                        Usar esta Firma <i className="ri-arrow-right-line"></i>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="placement-controls">
                    <div className="step-badge">Paso 2</div>
                    <h4>Coloca tu Firma</h4>
                    <p className="small-text">
                      Haz <strong>CLICK</strong> en el documento (izquierda) donde quieras que aparezca tu firma.
                    </p>

                    <div className="current-signature-preview">
                      <p>Tu firma:</p>
                      <img src={signatureImageUrl} alt="Tu firma" />
                    </div>

                    {isSignaturePlaced ? (
                      <div className="placement-confirm-box">
                        <p>¿Estás conforme con la ubicación?</p>
                        <button className="btn-primary full-width" onClick={() => void confirmPlacement()} disabled={isSigning}>
                          {isSigning ? "Firmando..." : "Confirmar y Firmar"}
                        </button>
                        <button className="btn-secondary full-width" onClick={cancelPlacement}>
                          Reposicionar
                        </button>
                      </div>
                    ) : (
                      <div className="waiting-placement">
                        <i className="ri-cursor-line blink"></i>
                        <p>Esperando click en el documento...</p>
                      </div>
                    )}

                    <button
                      className="btn-link-danger"
                      onClick={() => {
                        setSignatureDrawn(false);
                        setIsSignaturePlaced(false);
                      }}
                    >
                      Volver a dibujar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFSignatureNewClient;
