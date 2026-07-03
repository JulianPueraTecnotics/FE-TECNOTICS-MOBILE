/**
 * Parche local de @expo/metro-runtime LogContext — evita crash si `raw.logs` es undefined.
 */
import React from "react";
import { LogBoxLog } from "@expo/metro-runtime/src/error-overlay/Data/LogBoxLog";

export const LogContext = React.createContext<{
  selectedLogIndex: number;
  isDisabled: boolean;
  logs: LogBoxLog[];
} | null>(null);

export function useLogs(): {
  selectedLogIndex: number;
  isDisabled: boolean;
  logs: LogBoxLog[];
} {
  const logs = React.useContext(LogContext);
  if (!logs) {
    if (process.env.EXPO_OS === "web" && typeof window !== "undefined") {
      const expoCliStaticErrorElement = document.getElementById("_expo-static-error");
      if (expoCliStaticErrorElement?.textContent) {
        const raw = JSON.parse(expoCliStaticErrorElement.textContent) as {
          selectedLogIndex?: number;
          isDisabled?: boolean;
          logs?: unknown[];
        };
        return {
          selectedLogIndex: raw.selectedLogIndex ?? 0,
          isDisabled: raw.isDisabled ?? false,
          logs: (raw.logs ?? []).map((entry) => new LogBoxLog(entry as never)),
        };
      }
    }

    throw new Error("useLogs must be used within a LogProvider");
  }
  return logs;
}

export function useSelectedLog() {
  const { selectedLogIndex, logs } = useLogs();
  return logs[selectedLogIndex];
}
