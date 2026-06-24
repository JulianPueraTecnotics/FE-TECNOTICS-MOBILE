/**
 * Stub react-pdf — pdfjs usa DOMMatrix (solo web).
 */
const React = require("react");

const pdfjs = {
  version: "0.0.0",
  GlobalWorkerOptions: { workerSrc: "" },
};

function Document() {
  return null;
}

function Page() {
  return null;
}

module.exports = { Document, Page, pdfjs };
module.exports.Document = Document;
module.exports.Page = Page;
module.exports.pdfjs = pdfjs;
