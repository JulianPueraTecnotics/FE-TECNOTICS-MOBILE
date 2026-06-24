import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import "./SignaturePad.css";

export interface SignaturePadHandle {
    getDataUrl: () => string | null;
    clear: () => void;
    isEmpty: () => boolean;
}

interface SignaturePadProps {
    height?: number;
    disabled?: boolean;
}

/**
 * Pad de firma con canvas HTML nativo (sin librerías), portado del patrón de GenesisX.
 * Captura con eventos Pointer (mouse + touch) y exporta PNG dataURL.
 */
const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(({ height = 220, disabled = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);

    // Inicializa el canvas con fondo blanco y resolución correcta.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111827";
    }, [height]);

    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        drawing.current = true;
        last.current = pos(e);
        canvasRef.current?.setPointerCapture(e.pointerId);
    };
    const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current || disabled) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx || !last.current) return;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
        dirty.current = true;
    };
    const onUp = () => {
        drawing.current = false;
        last.current = null;
    };

    useImperativeHandle(ref, () => ({
        getDataUrl: () => (dirty.current && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null),
        clear: () => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !ctx) return;
            const rect = canvas.getBoundingClientRect();
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, rect.width, rect.height);
            dirty.current = false;
        },
        isEmpty: () => !dirty.current,
    }));

    return (
        <canvas
            ref={canvasRef}
            className="signature-pad"
            style={{ height }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
        />
    );
});

SignaturePad.displayName = "SignaturePad";
export default SignaturePad;
