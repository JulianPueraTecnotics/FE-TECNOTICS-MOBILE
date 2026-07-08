import { useSyncExternalStore } from "react";

/**
 * Estado global (fuera de React) para abrir/cerrar el chat de TEC.
 * Permite que el botón viva en la tab bar (MobileBottomNav) mientras el
 * modal del chat se monta en TecAssistant, en otra parte del árbol.
 */
let isOpen = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openTec() {
  if (!isOpen) {
    isOpen = true;
    emit();
  }
}

export function closeTec() {
  if (isOpen) {
    isOpen = false;
    emit();
  }
}

export function useTecOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => isOpen,
    () => isOpen
  );
}
