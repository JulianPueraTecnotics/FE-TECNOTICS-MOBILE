import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { Alert } from "react-native";
import type { ConfirmOptions, AlertOptions } from "./ConfirmProvider";

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

function normalizeConfirm(options: ConfirmOptions | string) {
  if (typeof options === "string") {
    return { title: "Confirmar acción", message: options, confirmText: "Continuar", cancelText: "Cancelar" };
  }
  return {
    title: options.title ?? "Confirmar acción",
    message: options.message,
    confirmText: options.confirmText ?? "Continuar",
    cancelText: options.cancelText ?? "Cancelar",
  };
}

function normalizeAlert(options: AlertOptions | string) {
  if (typeof options === "string") {
    return { title: "Aviso", message: options, confirmText: "Entendido" };
  }
  return {
    title: options.title ?? "Aviso",
    message: options.message,
    confirmText: options.confirmText ?? "Entendido",
  };
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const confirm = useCallback(
    (options: ConfirmOptions | string) =>
      new Promise<boolean>((resolve) => {
        const { title, message, confirmText, cancelText } = normalizeConfirm(options);
        Alert.alert(title, message, [
          { text: cancelText, style: "cancel", onPress: () => resolve(false) },
          { text: confirmText, onPress: () => resolve(true) },
        ]);
      }),
    [],
  );

  const alertFn = useCallback(
    (options: AlertOptions | string) =>
      new Promise<void>((resolve) => {
        const { title, message, confirmText } = normalizeAlert(options);
        Alert.alert(title, message, [{ text: confirmText, onPress: () => resolve() }]);
      }),
    [],
  );

  const value = useMemo(() => ({ confirm, alert: alertFn }), [confirm, alertFn]);

  return <ConfirmContext.Provider value={value}>{children}</ConfirmContext.Provider>;
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}

export type { ConfirmOptions, AlertOptions };
