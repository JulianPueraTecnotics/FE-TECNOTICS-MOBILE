import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AppConfirmDialog, type ConfirmVariant } from "./AppConfirmDialog";

export type ConfirmOptions = {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
};

export type AlertOptions = {
    title?: string;
    message: string;
    confirmText?: string;
    variant?: ConfirmVariant;
};

type DialogRequest = {
    kind: "confirm" | "alert";
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    variant: ConfirmVariant;
    resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
    confirm: (options: ConfirmOptions | string) => Promise<boolean>;
    alert: (options: AlertOptions | string) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

function normalizeConfirmOptions(options: ConfirmOptions | string): Omit<DialogRequest, "kind" | "resolve"> {
    if (typeof options === "string") {
        return {
            title: "Confirmar acción",
            message: options,
            confirmText: "Continuar",
            cancelText: "Cancelar",
            variant: "primary",
        };
    }
    return {
        title: options.title ?? "Confirmar acción",
        message: options.message,
        confirmText: options.confirmText ?? "Continuar",
        cancelText: options.cancelText ?? "Cancelar",
        variant: options.variant ?? "primary",
    };
}

function normalizeAlertOptions(options: AlertOptions | string): Omit<DialogRequest, "kind" | "resolve" | "cancelText"> {
    if (typeof options === "string") {
        return {
            title: "Aviso",
            message: options,
            confirmText: "Entendido",
            variant: "info",
        };
    }
    return {
        title: options.title ?? "Aviso",
        message: options.message,
        confirmText: options.confirmText ?? "Entendido",
        variant: options.variant ?? "info",
    };
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const queueRef = useRef<DialogRequest[]>([]);
    const [active, setActive] = useState<DialogRequest | null>(null);

    const enqueue = useCallback((req: DialogRequest) => {
        setActive((current) => {
            if (current) {
                queueRef.current.push(req);
                return current;
            }
            return req;
        });
    }, []);

    const closeActive = useCallback((result: boolean) => {
        setActive((current) => {
            current?.resolve(result);
            const next = queueRef.current.shift() ?? null;
            return next;
        });
    }, []);

    const confirm = useCallback(
        (options: ConfirmOptions | string) => new Promise<boolean>((resolve) => {
            const normalized = normalizeConfirmOptions(options);
            enqueue({ ...normalized, kind: "confirm", resolve });
        }),
        [enqueue],
    );

    const alertFn = useCallback(
        (options: AlertOptions | string) => new Promise<void>((resolve) => {
            const normalized = normalizeAlertOptions(options);
            enqueue({
                ...normalized,
                kind: "alert",
                cancelText: "",
                resolve: () => resolve(),
            });
        }),
        [enqueue],
    );

    const value = useMemo(() => ({ confirm, alert: alertFn }), [confirm, alertFn]);

    return (
        <ConfirmContext.Provider value={value}>
            {children}
            <AppConfirmDialog
                open={!!active}
                title={active?.title ?? ""}
                message={active?.message ?? ""}
                confirmText={active?.confirmText}
                cancelText={active?.cancelText}
                variant={active?.variant}
                hideCancel={active?.kind === "alert"}
                onConfirm={() => closeActive(true)}
                onCancel={() => closeActive(false)}
            />
        </ConfirmContext.Provider>
    );
}

export function useConfirm(): ConfirmContextValue {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
    return ctx;
}
