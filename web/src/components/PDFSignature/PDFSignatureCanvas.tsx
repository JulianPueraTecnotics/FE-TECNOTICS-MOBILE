import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument } from 'pdf-lib';
import toast from 'react-hot-toast';
import './PDFSignature.css';

// Configurar worker de PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFSignatureCanvasProps {
    pdfUrl: string;
    onSigned: (signedPdfFile: File) => void;
}

export const PDFSignatureCanvas: React.FC<PDFSignatureCanvasProps> = ({ pdfUrl, onSigned }) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [selectedPage, setSelectedPage] = useState<number>(2);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null);
    const [isSigning, setIsSigning] = useState(false);

    const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
    const [, setCanvasSize] = useState({ width: 0, height: 0 });

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    const onPageRenderSuccess = () => {
        // Cuando la página se renderiza, copiar el contenido al canvas de dibujo
        const pageCanvas = document.querySelector('.react-pdf__Page__canvas') as HTMLCanvasElement;
        if (pageCanvas && drawingCanvasRef.current) {
            const ctx = drawingCanvasRef.current.getContext('2d');
            if (ctx) {
                drawingCanvasRef.current.width = pageCanvas.width;
                drawingCanvasRef.current.height = pageCanvas.height;
                setCanvasSize({ width: pageCanvas.width, height: pageCanvas.height });
                ctx.drawImage(pageCanvas, 0, 0);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = drawingCanvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        onPageRenderSuccess(); // Re-renderizar la página limpia
    };

    const saveSignature = async () => {
        if (!drawingCanvasRef.current) {
            toast.error('No hay firma para guardar');
            return;
        }

        setIsSigning(true);

        try {
            // Obtener el PDF original
            const response = await fetch(pdfUrl);
            const pdfBytes = await response.arrayBuffer();
            const pdfDoc = await PDFDocument.load(pdfBytes);

            const pages = pdfDoc.getPages();
            const targetPage = pages[selectedPage - 1];

            // Convertir el canvas a imagen PNG
            const canvasDataUrl = drawingCanvasRef.current.toDataURL('image/png');
            const imageBytes = await fetch(canvasDataUrl).then(res => res.arrayBuffer());
            const image = await pdfDoc.embedPng(imageBytes);

            // Obtener dimensiones
            const { width, height } = targetPage.getSize();

            // Dibujar la imagen del canvas sobre la página del PDF
            // La imagen del canvas ya incluye el PDF + la firma
            targetPage.drawImage(image, {
                x: 0,
                y: 0,
                width: width,
                height: height,
            });

            // Guardar el PDF modificado
            const modifiedPdfBytes = await pdfDoc.save();
            const blob = new Blob([modifiedPdfBytes as any], { type: 'application/pdf' });
            setSignedPdfBlob(blob);

            const file = new File([blob], 'contrato_mandato_firmado.pdf', { type: 'application/pdf' });
            onSigned(file);

            toast.success('¡Firma agregada exitosamente!');
        } catch (error) {
            console.error('Error al firmar:', error);
            toast.error(`Error al firmar el documento: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        } finally {
            setIsSigning(false);
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
            {!signedPdfBlob ? (
                <div className="pdf-canvas-signature">
                    <div className="page-selector">
                        <label htmlFor="page-select">
                            <i className="ri-file-list-line"></i>
                            Página donde firmar:
                        </label>
                        <select
                            id="page-select"
                            value={selectedPage}
                            onChange={(e) => setSelectedPage(parseInt(e.target.value))}
                            className="page-select-dropdown"
                        >
                            {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
                                <option key={pageNum} value={pageNum}>
                                    Página {pageNum} de {numPages}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="canvas-container">
                        <div style={{ display: 'none' }}>
                            <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
                                <Page
                                    pageNumber={selectedPage}
                                    onRenderSuccess={onPageRenderSuccess}
                                    width={800}
                                />
                            </Document>
                        </div>

                        <canvas
                            ref={drawingCanvasRef}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            className="drawing-canvas"
                            style={{
                                border: '2px solid var(--primary-color)',
                                borderRadius: '8px',
                                cursor: 'crosshair',
                                maxWidth: '100%',
                                height: 'auto'
                            }}
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
                    </div>
                </>
            )}
        </div>
    );
};

export default PDFSignatureCanvas;
