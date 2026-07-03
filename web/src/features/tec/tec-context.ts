/**
 * Contexto de pantalla para el asistente TEC. Cada pantalla "publica" lo que el usuario
 * tiene a la vista (pantalla, descripción, datos del documento abierto) y el asistente
 * lo envía con cada mensaje para dar respuestas específicas ("a qué cuenta va el IVA de
 * ESTA factura", "¿esta compra tiene retención?").
 *
 * Es un singleton liviano (sin librería de estado): se setea desde un useEffect en la
 * pantalla y se limpia al desmontar. El TecChat lo lee justo antes de enviar.
 */
export interface TecContext {
    pantalla?: string;
    titulo?: string;
    descripcion?: string;
    datos?: Record<string, unknown>;
}

let current: TecContext | null = null;

/** La pantalla publica su contexto (típicamente en un useEffect). */
export const setTecContext = (ctx: TecContext | null): void => {
    current = ctx;
};

/** El asistente lee el contexto actual al enviar un mensaje. */
export const getTecContext = (): TecContext | null => current;

/**
 * Hook de conveniencia: publica el contexto mientras el componente está montado y lo
 * limpia al desmontar. Úsalo en cada pantalla con ayuda contextual.
 *
 *   useTecContext({ pantalla: "facturas", titulo: "Nueva factura", descripcion: "...", datos: {...} }, [deps])
 */
import { useEffect } from "react";
export const useTecContext = (ctx: TecContext | null, deps: unknown[] = []): void => {
    useEffect(() => {
        setTecContext(ctx);
        return () => setTecContext(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
};
