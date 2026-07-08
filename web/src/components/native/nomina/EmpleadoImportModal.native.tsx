import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  buildExistingDocsSet,
  mapRows,
  parseCsv,
  type ParsedRow,
} from "../../../features/nomina/empleados.bulk";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { DsSideModal } from "../../design-system-native";
import { createEmpleado, getAllEmpleadosFull, updateEmpleado, type Empleado } from "../../../services/empleados.service";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type ImportResult = { row: ParsedRow; ok: boolean; message?: string };

export default function EmpleadoImportModalNative({ visible, onClose, onSuccess }: Props) {
  const colors = useThemeColors();
  const [fileName, setFileName] = useState("");
  const [matrix, setMatrix] = useState<string[][] | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);

  useEffect(() => {
    if (!visible) return;
    void getAllEmpleadosFull()
      .then(setEmpleados)
      .catch(() => setEmpleados([]));
  }, [visible]);

  const { rows, derivedHeaderError } = useMemo(() => {
    if (!matrix) return { rows: [] as ParsedRow[], derivedHeaderError: null as string | null };
    const existing = buildExistingDocsSet(empleados);
    const { rows: parsed, headerError: hErr } = mapRows(matrix, existing);
    let err = hErr;
    if (!err && parsed.length === 0) err = "No se encontraron filas con datos.";
    return { rows: parsed, derivedHeaderError: err };
  }, [matrix, empleados]);

  const effectiveHeaderError = headerError ?? derivedHeaderError;

  const reset = () => {
    setFileName("");
    setMatrix(null);
    setHeaderError(null);
    setResults(null);
    setProgress({ done: 0, total: 0 });
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      if (/\.xlsx?$/i.test(asset.name)) {
        setHeaderError("Guarda el Excel como CSV UTF-8 e impórtalo de nuevo.");
        setMatrix(null);
        setFileName(asset.name);
        return;
      }
      setFileName(asset.name);
      const response = await fetch(asset.uri);
      const text = await response.text();
      setMatrix(parseCsv(text));
      setHeaderError(null);
    } catch {
      errorToast("No se pudo leer el archivo");
    }
  };

  const doImport = async () => {
    const validRows = rows.filter((r) => r.errors.length === 0);
    if (!validRows.length || effectiveHeaderError) return;
    setImporting(true);
    setProgress({ done: 0, total: validRows.length });
    const out: ImportResult[] = [];
    let okCount = 0;
    for (const row of validRows) {
      try {
        if (row.isUpdate) {
          const target = empleados.find((e) => e.numero_documento === row.input.numero_documento);
          if (target) await updateEmpleado(target._id, row.input);
          else await createEmpleado(row.input);
        } else {
          await createEmpleado(row.input);
        }
        out.push({ row, ok: true, message: row.isUpdate ? "Actualizado" : "Creado" });
        okCount++;
      } catch (e) {
        out.push({ row, ok: false, message: e instanceof Error ? e.message : "Error" });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setResults(out);
    setImporting(false);
    if (okCount > 0) {
      successToast(`${okCount} empleado(s) importados`);
      onSuccess();
    }
  };

  const footer = !results ? (
    <>
      <Pressable style={[styles.btnGhost, { borderColor: colors.border }]} onPress={close} disabled={importing}>
        <Text style={{ color: colors.primaryText }}>Cancelar</Text>
      </Pressable>
      <Pressable
        style={[styles.btnPrimary, { backgroundColor: colors.headerAccent, opacity: importing || !rows.length || !!effectiveHeaderError ? 0.5 : 1 }]}
        onPress={() => void doImport()}
        disabled={importing || !rows.length || !!effectiveHeaderError}
      >
        {importing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Importar</Text>}
      </Pressable>
    </>
  ) : (
    <Pressable style={[styles.btnPrimary, { backgroundColor: colors.headerAccent, flex: 1 }]} onPress={close}>
      <Text style={styles.btnPrimaryText}>Listo</Text>
    </Pressable>
  );

  return (
    <DsSideModal
      visible={visible}
      onClose={close}
      title="Importar empleados (CSV)"
      icon="cloud-upload-outline"
      closeDisabled={importing}
      footer={footer}
    >
      {!results ? (
        <>
          <Pressable style={[styles.drop, { borderColor: colors.headerAccent }]} onPress={() => void pickFile()}>
            <Ionicons name="document-outline" size={32} color={colors.headerAccent} />
            <Text style={{ color: colors.primaryText, fontWeight: "600" }}>Seleccionar CSV</Text>
            {fileName ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fileName}</Text> : null}
          </Pressable>
          {effectiveHeaderError ? (
            <Text style={{ color: "#dc2626", marginTop: 8 }}>{effectiveHeaderError}</Text>
          ) : rows.length ? (
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>
              {rows.length} fila(s): {rows.filter((r) => !r.isUpdate && r.errors.length === 0).length} nuevos,{" "}
              {rows.filter((r) => r.isUpdate && r.errors.length === 0).length} actualizaciones
            </Text>
          ) : null}
          {importing ? (
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>
              Procesando {progress.done}/{progress.total}…
            </Text>
          ) : null}
        </>
      ) : (
        results.map((r, i) => (
          <View key={i} style={[styles.resultRow, { borderColor: colors.border }]}>
            <Text style={{ color: colors.primaryText, fontWeight: "600" }}>{r.row.input.numero_documento}</Text>
            <Text style={{ color: r.ok ? "#059669" : "#dc2626", fontSize: 13 }}>{r.message}</Text>
          </View>
        ))
      )}
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  drop: { borderWidth: 2, borderStyle: "dashed", borderRadius: SHELL_RADIUS.card, padding: 24, alignItems: "center", gap: 8 },
  resultRow: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, padding: 12, marginBottom: 8, gap: 4 },
  btnGhost: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
  btnPrimary: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: SHELL_RADIUS.button },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
