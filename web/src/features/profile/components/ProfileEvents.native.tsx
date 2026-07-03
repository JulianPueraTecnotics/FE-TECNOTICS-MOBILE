import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { clearLogs, getLogs, type LogEntry } from "../../../services/logger.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";

function formatConsoleTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatConsoleDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ProfileEventsNative() {
  const colors = useThemeColors();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    if (logs.length > 0) setFetching(true);
    else setLoading(true);
    try {
      const response = await getLogs(page, 20);
      if (response?.ok && response.logs) {
        setLogs(response.logs);
        setTotalPages(response.pagination?.totalPages ?? 1);
        setTotal(response.pagination?.total ?? 0);
      }
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar eventos");
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [page, logs.length]);

  useEffect(() => {
    void load();
  }, [load]);

  const onClear = () => {
    Alert.alert(
      "Limpiar consola",
      "¿Eliminar todos los registros? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              const response = await clearLogs();
              if (response?.ok) {
                successToast(response.message ?? "Historial vaciado");
                setPage(1);
                setLogs([]);
                await load();
              }
            } catch (error) {
              errorToast(error instanceof Error ? error.message : "Error al vaciar");
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.primary }]}>Consola de eventos</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Registro de actividad: facturas, clientes, productos
          </Text>
        </View>
        <Pressable
          style={[styles.clearBtn, { borderColor: colors.border, opacity: total === 0 ? 0.5 : 1 }]}
          disabled={loading || fetching || clearing || total === 0}
          onPress={onClear}
        >
          {clearing ? (
            <ActivityIndicator size="small" color="#c0392b" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color="#c0392b" />
              <Text style={styles.clearText}>Limpiar</Text>
            </>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.headerAccent} />
      ) : logs.length === 0 ? (
        <View style={[styles.console, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
          <Text style={[styles.prompt, { color: colors.headerAccent }]}>$</Text>
          <Text style={{ color: colors.textMuted, fontFamily: "monospace" }}> Sin eventos registrados.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {logs.map((log) => (
            <View
              key={log._id}
              style={[
                styles.logRow,
                getSoftCardShadow(colors),
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.logMeta, { color: colors.textMuted }]}>
                {formatConsoleDate(log.date)} {formatConsoleTime(log.date)}
              </Text>
              <Text style={[styles.logText, { color: colors.primaryText }]}>{log.description}</Text>
            </View>
          ))}
          {totalPages > 1 ? (
            <View style={styles.pager}>
              <Pressable disabled={page <= 1 || fetching} onPress={() => setPage((p) => p - 1)}>
                <Text style={{ color: page <= 1 ? colors.textMuted : colors.headerAccent }}>Anterior</Text>
              </Pressable>
              <Text style={{ color: colors.textMuted }}>
                {page}/{totalPages} · {total} eventos
              </Text>
              <Pressable disabled={page >= totalPages || fetching} onPress={() => setPage((p) => p + 1)}>
                <Text style={{ color: page >= totalPages ? colors.textMuted : colors.headerAccent }}>Siguiente</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "700" },
  sub: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.button,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearText: { color: "#c0392b", fontWeight: "600", fontSize: 12 },
  console: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.card,
    padding: 14,
    marginTop: 8,
  },
  prompt: { fontFamily: "monospace", fontWeight: "700" },
  list: { gap: 8, paddingBottom: 16 },
  logRow: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12 },
  logMeta: { fontSize: 11, fontFamily: "monospace", marginBottom: 4 },
  logText: { fontSize: 13, lineHeight: 19 },
  pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
});
