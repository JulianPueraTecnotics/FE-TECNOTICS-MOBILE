import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import ItemPickerFieldNative, { InvFieldLabel, InvTextInput } from "../../../components/native/inventory/InventoryUi.native";
import LoadingScreen from "../../../router/LoadingScreen";
import { createWarehouse, getWarehouses, updateWarehouse } from "../inventory.service";
import type { Warehouse } from "../inventory.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";

const emptyForm = () => ({ codigo: "", nombre: "", direccion: "", municipio: "", es_principal: false });

export default function BodegasNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await getWarehouses());
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar bodegas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setForm({
      codigo: w.codigo,
      nombre: w.nombre,
      direccion: w.direccion ?? "",
      municipio: w.municipio ?? "",
      es_principal: w.es_principal,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || (!editing && !form.codigo.trim())) {
      errorToast("Completa código y nombre");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateWarehouse(editing._id, {
          nombre: form.nombre.trim(),
          direccion: form.direccion.trim() || undefined,
          municipio: form.municipio.trim() || undefined,
          es_principal: form.es_principal,
        });
        successToast("Bodega actualizada");
      } else {
        await createWarehouse({
          codigo: form.codigo.trim(),
          nombre: form.nombre.trim(),
          direccion: form.direccion.trim() || undefined,
          municipio: form.municipio.trim() || undefined,
          es_principal: form.es_principal,
        });
        successToast("Bodega creada");
      }
      setModalOpen(false);
      setLoading(true);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !refreshing) return <LoadingScreen />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.headerAccent} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 80 }}
      >
        {rows.map((w) => (
          <Pressable
            key={w._id}
            onPress={() => openEdit(w)}
            style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.code, { color: colors.headerAccent }]}>{w.codigo}</Text>
              {w.es_principal ? (
                <View style={styles.badge}>
                  <Text style={{ color: "#166534", fontSize: 11, fontWeight: "700" }}>Principal</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.name, { color: colors.primaryText }]}>{w.nombre}</Text>
            {w.municipio ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{w.municipio}</Text> : null}
            <Text style={{ color: w.estado === "activa" ? "#166534" : "#991b1b", fontSize: 12, marginTop: 6, fontWeight: "600" }}>
              {w.estado === "activa" ? "Activa" : "Inactiva"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable style={[styles.fab, { backgroundColor: colors.headerAccent, bottom: insets.paddingBottom + 16 }]} onPress={openCreate}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.sheetTitle, { color: colors.primaryText }]}>{editing ? "Editar bodega" : "Nueva bodega"}</Text>
            {!editing ? (
              <>
                <InvFieldLabel>Código *</InvFieldLabel>
                <InvTextInput value={form.codigo} onChangeText={(v) => setForm((f) => ({ ...f, codigo: v }))} placeholder="Ej. BOD01" />
              </>
            ) : null}
            <InvFieldLabel>Nombre *</InvFieldLabel>
            <InvTextInput value={form.nombre} onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))} />
            <InvFieldLabel>Municipio</InvFieldLabel>
            <InvTextInput value={form.municipio} onChangeText={(v) => setForm((f) => ({ ...f, municipio: v }))} />
            <InvFieldLabel>Dirección</InvFieldLabel>
            <InvTextInput value={form.direccion} onChangeText={(v) => setForm((f) => ({ ...f, direccion: v }))} multiline />
            <Pressable
              onPress={() => setForm((f) => ({ ...f, es_principal: !f.es_principal }))}
              style={[styles.checkRow, { borderColor: colors.border }]}
            >
              <Ionicons name={form.es_principal ? "checkbox" : "square-outline"} size={22} color={colors.headerAccent} />
              <Text style={{ color: colors.primaryText }}>Bodega principal</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <LedgerPrimaryBtn label="Cancelar" variant="secondary" onPress={() => setModalOpen(false)} />
              <LedgerPrimaryBtn label="Guardar" onPress={handleSave} loading={saving} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontWeight: "800", fontSize: 13 },
  badge: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: SHELL_RADIUS.button },
  name: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  fab: { position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", elevation: 4 },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { maxHeight: "85%", borderTopLeftRadius: SHELL_RADIUS.menuItem, borderTopRightRadius: SHELL_RADIUS.menuItem, padding: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
});
