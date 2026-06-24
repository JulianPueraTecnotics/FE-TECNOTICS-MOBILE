import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { importPurchaseFiles, type PurchaseUploadFile } from "../../../features/purchases/purchases.service";
import { importResultTone, purchaseKindMeta } from "../../../features/purchases/purchases.shared";
import type { ImportResponse, PurchaseKind } from "../../../features/purchases/purchases.types";
import { formatCOP } from "../../../utils/format";

type PickedFile = PurchaseUploadFile & { id: string };

type Props = {
  visible: boolean;
  kind: PurchaseKind;
  onClose: () => void;
  onImported: () => void;
};

export default function ImportModalNative({ visible, kind, onClose, onImported }: Props) {
  const colors = useThemeColors();
  const meta = purchaseKindMeta(kind);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const reset = () => {
    setFiles([]);
    setResult(null);
    setImporting(false);
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const pickFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/xml", "text/xml", "application/zip", "application/x-zip-compressed"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const picked = res.assets
        .filter((a) => /\.(xml|zip)$/i.test(a.name))
        .map((a) => ({
          id: `${a.name}-${a.uri}`,
          uri: a.uri,
          name: a.name,
          type: a.mimeType || (a.name.toLowerCase().endsWith(".zip") ? "application/zip" : "application/xml"),
        }));
      if (picked.length !== res.assets.length) errorToast("Solo se admiten archivos XML o ZIP");
      if (picked.length) setFiles((prev) => [...prev, ...picked]);
    } catch {
      errorToast("No se pudieron seleccionar archivos");
    }
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const doImport = async () => {
    if (!files.length) {
      errorToast("Agrega al menos un archivo");
      return;
    }
    setImporting(true);
    try {
      const res = await importPurchaseFiles(
        kind,
        files.map(({ uri, name, type }) => ({ uri, name, type }))
      );
      setResult(res);
      if (res.imported > 0) onImported();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo importar");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.wrap, { backgroundColor: colors.pageBg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={close} disabled={importing}>
            <Ionicons name="close" size={24} color={colors.primaryText} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>
            Importar {meta.importLabel} (XML / ZIP)
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {!result ? (
            <>
              <Pressable
                style={[styles.dropzone, { borderColor: colors.accent, backgroundColor: colors.bgSubtle }]}
                onPress={() => void pickFiles()}
                disabled={importing}
              >
                <Ionicons name="cloud-upload-outline" size={36} color={colors.accent} />
                <Text style={[styles.dropTitle, { color: colors.primaryText }]}>Seleccionar archivos XML o ZIP</Text>
                <Text style={[styles.dropHint, { color: colors.textMuted }]}>
                  Puedes importar varios a la vez
                </Text>
              </Pressable>

              {files.map((f) => (
                <View
                  key={f.id}
                  style={[styles.fileRow, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                >
                  <Ionicons
                    name={f.name.toLowerCase().endsWith(".zip") ? "folder-outline" : "document-text-outline"}
                    size={20}
                    color={colors.accent}
                  />
                  <Text style={[styles.fileName, { color: colors.primaryText }]} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Pressable onPress={() => removeFile(f.id)} disabled={importing}>
                    <Ionicons name="close-circle" size={22} color="#dc2626" />
                  </Pressable>
                </View>
              ))}

              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Si el proveedor o el producto no existen, se crean automáticamente al importar.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <Chip label={`${result.imported} importadas`} tone="ok" />
                <Chip label={`${result.duplicates} duplicadas`} tone="dup" />
                <Chip label={`${result.errors} con error`} tone="err" />
              </View>
              {result.results.map((r, i) => {
                const tone = importResultTone(r);
                return (
                  <View
                    key={`${r.fileName}-${i}`}
                    style={[styles.resultCard, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                  >
                    <Text style={[styles.resultFile, { color: colors.primaryText }]}>{r.fileName}</Text>
                    <Text style={[styles.resultMeta, { color: colors.textMuted }]}>
                      {r.document || "—"} · {r.supplier_name || "—"} · {r.total ? formatCOP(r.total) : "—"}
                    </Text>
                    <Text
                      style={[
                        styles.resultMsg,
                        { color: tone === "ok" ? "#059669" : tone === "dup" ? "#d97706" : "#dc2626" },
                      ]}
                    >
                      {r.message}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.cardBg }]}>
          {!result ? (
            <>
              <Pressable style={[styles.btnGhost, { borderColor: colors.border }]} onPress={close} disabled={importing}>
                <Text style={{ color: colors.primaryText }}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, { backgroundColor: colors.accent, opacity: importing || !files.length ? 0.6 : 1 }]}
                onPress={() => void doImport()}
                disabled={importing || !files.length}
              >
                {importing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Importar {files.length || ""}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={[styles.btnGhost, { borderColor: colors.border }]} onPress={reset}>
                <Text style={{ color: colors.primaryText }}>Importar más</Text>
              </Pressable>
              <Pressable style={[styles.btnPrimary, { backgroundColor: colors.accent }]} onPress={close}>
                <Text style={styles.btnPrimaryText}>Listo</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Chip({ label, tone }: { label: string; tone: "ok" | "dup" | "err" }) {
  const bg = tone === "ok" ? "#d1fae5" : tone === "dup" ? "#fef3c7" : "#fee2e2";
  const fg = tone === "ok" ? "#065f46" : tone === "dup" ? "#92400e" : "#991b1b";
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  body: { padding: 16, gap: 10, paddingBottom: 24 },
  dropzone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: SHELL_RADIUS.menuItem,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  dropTitle: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  dropHint: { fontSize: 13, textAlign: "center" },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  fileName: { flex: 1, fontSize: 14 },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  resultCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  resultFile: { fontSize: 14, fontWeight: "600" },
  resultMeta: { fontSize: 12 },
  resultMsg: { fontSize: 13, fontWeight: "500" },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnGhost: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  btnPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});
