import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import toast from 'react-hot-toast';
import './PDFSignature.css';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

const SIGNATURE_BOX_WIDTH = 220;
const SIGNATURE_BOX_HEIGHT = 120;

interface PDFSignatureProps {
  pdfUrl: string;
  onSigned: (signedPdfFile: File) => void;
}

export const PDFSignature: React.FC<PDFSignatureProps> = ({ pdfUrl, onSigned }) => {
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureDrawn, setSignatureDrawn] = useState(false);
  const [signatureImageUrl, setSignatureImageUrl] = useState<string>('');
  const [signaturePosition, setSignaturePosition] = useState({ x: 50, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [renderSource, setRenderSource] = useState(pdfUrl);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [pdfPageSize, setPdfPageSize] = useState({ width: 0, height: 0 });
  const signatureRef = useRef<SignatureCanvas>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const signatureBoxRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(showSignatureModal);

  console.log('📥 [PDFSignature] Componente montado con pdfUrl:', pdfUrl);
  console.log('📥 [PDFSignature] Tipo de pdfUrl:', typeof pdfUrl);
  console.log('📥 [PDFSignature] pdfUrl es válido:', !!pdfUrl);

  useEffect(() => {
    let blobUrl: string | null = null;

    if (signedPdfBlob) {
      blobUrl = URL.createObjectURL(signedPdfBlob);
      setRenderSource(blobUrl);
    } else {
      setRenderSource(pdfUrl);
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [signedPdfBlob, pdfUrl]);

  useEffect(() => {
    if (!showSignatureModal || !signatureDrawn || !renderSource) {
      return;
    }

    let isMounted = true;

    const renderPdf = async () => {
      try {
        setIsPdfLoading(true);
        console.log('📄 [PDFSignature] Renderizando PDF desde:', renderSource);

        const response = await fetch(renderSource);
        if (!response.ok) {
          throw new Error(`No se pudo descargar el PDF (${response.status})`);
        }

        const pdfBytes = await response.arrayBuffer();
        const loadingTask = getDocument({ data: pdfBytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pdf.numPages);
        const originalViewport = page.getViewport({ scale: 1 });

        let containerWidth = pdfContainerRef.current?.clientWidth || originalViewport.width;
        if (containerWidth <= 0) {
          containerWidth = originalViewport.width;
        }

        const scale = containerWidth / originalViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = pdfCanvasRef.current;
        const context = canvas?.getContext('2d');

        if (!canvas || !context || !isMounted) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        setCanvasSize({ width: viewport.width, height: viewport.height });
        setPdfPageSize({ width: originalViewport.width, height: originalViewport.height });

        await page.render({ canvasContext: context, viewport, canvas }).promise;

        if (!isMounted) return;

        setSignaturePosition({
          x: viewport.width / 2 - SIGNATURE_BOX_WIDTH / 2,
          y: viewport.height - SIGNATURE_BOX_HEIGHT - 40,
        });
      } catch (error) {
        console.error('❌ [PDFSignature] Error al renderizar PDF', error);
        toast.error('No se pudo cargar el PDF para previsualizarlo');
      } finally {
        if (isMounted) {
          setIsPdfLoading(false);
        }
      }
    };

    const raf = requestAnimationFrame(renderPdf);

    return () => {
      isMounted = false;
      cancelAnimationFrame(raf);
    };
  }, [showSignatureModal, signatureDrawn, renderSource]);

  const clearSignature = () => {
    signatureRef.current?.clear();
    setSignatureDrawn(false);
    setSignatureImageUrl('');
  };

  const confirmSignatureDrawing = () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast.error('Por favor dibuja tu firma primero');
      return;
    }
    
    // Guardar la imagen de la firma
    const imageUrl = signatureRef.current.toDataURL('image/png');
    setSignatureImageUrl(imageUrl);
    setSignatureDrawn(true);
    toast.success('Ahora arrastra tu firma sobre el PDF a donde quieras posicionarla');
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signatureImageUrl || isPdfLoading) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !pdfContainerRef.current) return;
    
    e.preventDefault();
    
    const containerRect = pdfContainerRef.current.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffset.x;
    const newY = e.clientY - containerRect.top - dragOffset.y;
    
    const maxX = containerRect.width - SIGNATURE_BOX_WIDTH;
    const maxY = containerRect.height - SIGNATURE_BOX_HEIGHT;
    
    setSignaturePosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      console.log('🖱️ Mouse up - firma soltada en:', signaturePosition);
      setIsDragging(false);
    }
  };

  const saveSignature = async () => {
    console.log('🖊️ [PDFSignature] saveSignature llamado');
    
    if (!signatureImageUrl) {
      console.error('❌ [PDFSignature] signatureImageUrl está vacío');
      toast.error('Error: No hay firma para guardar');
      return;
    }

    console.log('✅ [PDFSignature] Firma disponible para guardar');
    setIsSigning(true);

    try {
      console.log('🖊️ [PDFSignature] Paso 1: Usando firma guardada...');
      console.log('✅ [PDFSignature] Firma disponible, longitud:', signatureImageUrl.length);
      
      console.log('🖊️ [PDFSignature] Paso 2: Descargando PDF desde:', pdfUrl);
      const response = await fetch(pdfUrl);
      console.log('✅ [PDFSignature] Respuesta del fetch:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Error al descargar PDF: ${response.status} ${response.statusText}`);
      }
      
      console.log('🖊️ [PDFSignature] Paso 3: Convirtiendo a ArrayBuffer...');
      const pdfBytes = await response.arrayBuffer();
      console.log('✅ [PDFSignature] PDF descargado, tamaño:', pdfBytes.byteLength, 'bytes');
      
      console.log('🖊️ [PDFSignature] Paso 4: Cargando PDF con pdf-lib...');
      const pdfDoc = await PDFDocument.load(pdfBytes);
      console.log('✅ [PDFSignature] PDF cargado exitosamente en pdf-lib');
      
      const pages = pdfDoc.getPages();
      console.log('✅ [PDFSignature] Número de páginas:', pages.length);
      const lastPage = pages[pages.length - 1];
      console.log('✅ [PDFSignature] Última página obtenida, dimensiones:', lastPage.getWidth(), 'x', lastPage.getHeight());
      
      console.log('🖊️ [PDFSignature] Paso 5: Convirtiendo firma a bytes...');
      const signatureImageBytes = await fetch(signatureImageUrl).then(res => res.arrayBuffer());
      console.log('✅ [PDFSignature] Firma convertida a bytes, tamaño:', signatureImageBytes.byteLength);
      
      console.log('🖊️ [PDFSignature] Paso 6: Embebiendo imagen PNG en PDF...');
      const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
      console.log('✅ [PDFSignature] Imagen PNG embebida exitosamente');

      if (!canvasSize.width || !canvasSize.height || !pdfPageSize.width || !pdfPageSize.height) {
        throw new Error('Dimensiones del PDF no disponibles para posicionar la firma');
      }

      const widthRatio = pdfPageSize.width / canvasSize.width;
      const heightRatio = pdfPageSize.height / canvasSize.height;

      const pdfSignatureWidth = SIGNATURE_BOX_WIDTH * widthRatio;
      const pdfSignatureHeight = SIGNATURE_BOX_HEIGHT * heightRatio;

      const signatureX = signaturePosition.x * widthRatio;
      const signatureY = pdfPageSize.height - ((signaturePosition.y + SIGNATURE_BOX_HEIGHT) * heightRatio);
      
      console.log('✅ [PDFSignature] Posición de firma en lienzo:', signaturePosition);
      console.log('✅ [PDFSignature] Posición convertida a PDF:', `x=${signatureX}, y=${signatureY}`);
      
      console.log('🖊️ [PDFSignature] Paso 7: Dibujando firma en PDF...');
      lastPage.drawImage(signatureImage, {
        x: signatureX,
        y: signatureY,
        width: pdfSignatureWidth,
        height: pdfSignatureHeight,
      });
      console.log('✅ [PDFSignature] Firma dibujada en la última página');
      
      console.log('🖊️ [PDFSignature] Paso 8: Guardando PDF modificado...');
      const modifiedPdfBytes = await pdfDoc.save();
      console.log('✅ [PDFSignature] PDF guardado, tamaño final:', modifiedPdfBytes.byteLength, 'bytes');
      
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' });
      console.log('✅ [PDFSignature] Blob creado');
      
      setSignedPdfBlob(blob);
      console.log('✅ [PDFSignature] Estado signedPdfBlob actualizado');
      
      const file = new File([blob], 'contrato_mandato_firmado.pdf', { type: 'application/pdf' });
      console.log('✅ [PDFSignature] File creado:', file.name, file.size, 'bytes');
      
      onSigned(file);
      console.log('✅ [PDFSignature] Callback onSigned ejecutado');
      
      toast.success('¡Firma agregada exitosamente!');
      
      setTimeout(() => {
        console.log('✅ [PDFSignature] Cerrando modal...');
        setShowSignatureModal(false);
      }, 500);
      
    } catch (error) {
      console.error('❌ [PDFSignature] Error en saveSignature:', error);
      console.error('❌ [PDFSignature] Stack trace:', error instanceof Error ? error.stack : 'No stack');
      toast.error(`Error al firmar el documento: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSigning(false);
      console.log('✅ [PDFSignature] Proceso de firma finalizado');
    }
  };

  const downloadSignedPDF = () => {
    if (signedPdfBlob) {
      const url = URL.createObjectURL(signedPdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contrato_mandato_firmado.pdf';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('PDF descargado');
    }
  };

  return (
    <div className="pdf-signature-container">
      <div className="pdf-actions-main">
        {!signedPdfBlob ? (
          <button
            type="button"
            className="btn-primary btn-lg"
            onClick={() => setShowSignatureModal(true)}
          >
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
              <button
                type="button"
                className="btn-success"
                onClick={downloadSignedPDF}
              >
                <i className="ri-download-line"></i>
                Descargar PDF Firmado
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSignedPdfBlob(null);
                  setShowSignatureModal(true);
                }}
              >
                <i className="ri-edit-line"></i>
                Volver a Firmar
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal de Firma con PDF completo */}
      {showSignatureModal && (
        <div className="signature-modal-overlay" onClick={() => setShowSignatureModal(false)}>
          <div className="signature-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="signature-modal-header">
              <h3>Revisar y Firmar Contrato de Mandato</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => {
                  setShowSignatureModal(false);
                  setSignatureDrawn(false);
                  setSignatureImageUrl('');
                  setSignaturePosition({ x: 50, y: 100 });
                }}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            {!signatureDrawn ? (
              // Paso 1: Dibujar firma
              <div className="signature-drawing-step">
                <div className="step-instructions">
                  <i className="ri-quill-pen-line"></i>
                  <h4>Paso 1: Dibuja tu Firma</h4>
                  <p>Usa el mouse o tu dedo para dibujar tu firma en el recuadro</p>
                </div>

                <div className="signature-canvas-wrapper-center">
                  <SignatureCanvas
                    ref={signatureRef}
                    canvasProps={{
                      className: 'signature-canvas',
                      width: 500,
                      height: 250,
                    }}
                    backgroundColor="white"
                  />
                </div>

                <div className="signature-actions-center">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={clearSignature}
                  >
                    <i className="ri-eraser-line"></i>
                    Limpiar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={confirmSignatureDrawing}
                  >
                    <i className="ri-arrow-right-line"></i>
                    Continuar
                  </button>
                </div>
              </div>
            ) : (
              // Paso 2: Posicionar firma sobre PDF
              <div className="signature-positioning-step">
                <div className="step-instructions-compact">
                  <i className="ri-drag-move-line"></i>
                  <span><strong>Paso 2:</strong> Arrastra tu firma a donde quieras posicionarla en el documento</span>
                </div>

                <div className="pdf-preview-section">
                  {isPdfLoading ? (
                    <div className="pdf-loading-state">
                      <i className="ri-loader-4-line rotating"></i>
                      <span>Cargando contrato...</span>
                    </div>
                  ) : (
                    <div 
                      ref={pdfContainerRef}
                      className={`pdf-with-signature-overlay ${isDragging ? 'dragging' : ''}`}
                      style={{
                        width: canvasSize.width || '100%',
                        height: canvasSize.height || 'auto',
                      }}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <canvas
                        ref={pdfCanvasRef}
                        className="pdf-canvas-preview"
                      />
                      
                      <div
                        ref={signatureBoxRef}
                        className={`draggable-signature ${isDragging ? 'dragging' : ''}`}
                        style={{
                          left: `${signaturePosition.x}px`,
                          top: `${signaturePosition.y}px`,
                          width: SIGNATURE_BOX_WIDTH,
                          height: SIGNATURE_BOX_HEIGHT,
                          cursor: isDragging ? 'grabbing' : 'grab',
                        }}
                        onMouseDown={handleMouseDown}
                      >
                        <img 
                          src={signatureImageUrl} 
                          alt="Tu firma"
                          draggable={false}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="signature-actions-center">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSignatureDrawn(false)}
                  >
                    <i className="ri-arrow-left-line"></i>
                    Volver a Dibujar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={saveSignature}
                    disabled={isSigning}
                  >
                    {isSigning ? (
                      <>
                        <i className="ri-loader-4-line rotating"></i>
                        Firmando...
                      </>
                    ) : (
                      <>
                        <i className="ri-check-line"></i>
                        Confirmar y Firmar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFSignature;

