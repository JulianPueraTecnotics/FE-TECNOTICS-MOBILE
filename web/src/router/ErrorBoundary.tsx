import { Component } from "react";
import type { ReactNode } from "react";

interface Props {
    children: ReactNode;
}
interface State {
    hasError: boolean;
    message?: string;
}

/**
 * Aísla los errores de render de una PÁGINA para que no tumben el árbol completo
 * (navbar + sidebar). Sin esto, un throw en cualquier página deja la app en blanco
 * y el usuario pierde la navegación. Muestra un fallback y permite recargar.
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: unknown): State {
        return { hasError: true, message: error instanceof Error ? error.message : "Error inesperado" };
    }

    componentDidCatch(error: unknown) {
        console.error("[ErrorBoundary] página falló:", error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted, #64748b)" }}>
                    <i className="ri-error-warning-line" style={{ fontSize: 40, color: "var(--tertiary-color, #ef4444)" }} />
                    <h2 style={{ margin: "12px 0 6px", color: "var(--text-color, #1a202c)" }}>Algo salió mal en esta pantalla</h2>
                    <p style={{ margin: "0 0 16px" }}>{this.state.message}</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ background: "var(--accent-teal, #5a9fb4)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontWeight: 600 }}
                    >
                        Recargar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
