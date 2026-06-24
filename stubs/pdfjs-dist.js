/**
 * Stub pdfjs-dist — APIs DOM (DOMMatrix, Worker, canvas) no existen en Hermes.
 */
const GlobalWorkerOptions = { workerSrc: "" };

function getDocument() {
  return Promise.reject(
    new Error("PDF no disponible en la app nativa. Usa npm run web."),
  );
}

module.exports = { getDocument, GlobalWorkerOptions, version: "0.0.0" };
module.exports.default = module.exports;
