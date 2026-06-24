import React, { useState } from "react";
import "./CopyButton.css";

interface CopyButtonProps {
    /** Texto a copiar al portapapeles. */
    value?: string | null;
    /** Texto del tooltip (por defecto "Copiar"). */
    title?: string;
    /** Etiqueta accesible de lo que se copia (ej. "documento"). */
    label?: string;
}

/**
 * Botón pequeño para copiar un valor al portapapeles. Muestra un check breve al copiar.
 * No se renderiza si el valor está vacío o es "N/A".
 */
const CopyButton: React.FC<CopyButtonProps> = ({ value, title = "Copiar", label }) => {
    const [copied, setCopied] = useState(false);

    const text = (value ?? "").toString().trim();
    if (!text || text === "N/A") return null;

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback para contextos sin Clipboard API.
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                ta.remove();
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
        } catch {
            // Silencioso: si falla el portapapeles no rompemos la UI.
        }
    };

    return (
        <button
            type="button"
            className={`copy-btn ${copied ? "copy-btn--copied" : ""}`}
            onClick={handleCopy}
            title={copied ? "¡Copiado!" : title}
            aria-label={label ? `Copiar ${label}` : title}
        >
            <i className={copied ? "ri-check-line" : "ri-file-copy-line"} aria-hidden></i>
        </button>
    );
};

export default CopyButton;
