import { lazy, Suspense } from "react";

const PDFSignatureNewClient = lazy(() => import("./PDFSignatureNewClient.web"));

interface PDFSignatureNewProps {
  pdfUrl: string;
  onSigned: (signedPdfFile: File) => void;
}

/** Solo cliente — evita cargar react-pdf/pdfjs en SSR (DOMMatrix). */
export default function PDFSignatureNew(props: PDFSignatureNewProps) {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    <Suspense fallback={<div className="pdf-loading-state">Cargando visor de firma…</div>}>
      <PDFSignatureNewClient {...props} />
    </Suspense>
  );
}

export { PDFSignatureNew };
