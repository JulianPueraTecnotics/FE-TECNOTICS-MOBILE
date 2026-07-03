import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import TerceroModalNative from "../../../components/native/terceros/TerceroModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerChip, LedgerChipRow, LedgerPrimaryBtn, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { backfillTerceros, deleteTercero, getTerceros, migrateTerceros } from "../terceros.service";
import { ROLE_LABELS, type Tercero, type TerceroRole } from "../terceros.types";

const PAGE_SIZE = 20;
const ROLES: (TerceroRole | "")[] = ["", "cliente", "proveedor", "empleado"];

export default function TercerosNative() {
  const colors = useThemeColors();
  const [rows, setRows] = useState<Tercero[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [rol, setRol] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [modalOpen, setModalOpen] = useState(false);
  const [edit, setEdit] = useState<Tercero | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTerceros(page, PAGE_SIZE, debounced.trim(), rol);
      setRows(res.terceros);
      setTotalPages(res.pagination.totalPages);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar terceros");
    } finally {
      setLoading(false);
    }
  }, [page, debounced, rol]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debounced, rol]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onMigrate = () => {
    Alert.alert("Importar existentes", "¿Migrar clientes, proveedores y empleados al maestro de terceros?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Importar",
        onPress: async () => {
          setBusy(true);
          try {
            const res = await migrateTerceros();
            successToast(res.message || "Migración completada");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onBackfill = () => {
    Alert.alert("Vincular IDs", "¿Vincular IDs de terceros en documentos existentes?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Vincular",
        onPress: async () => {
          setBusy(true);
          try {
            const res = await backfillTerceros();
            successToast(res.message);
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onDelete = (t: Tercero) => {
    Alert.alert("Eliminar", `¿Eliminar ${t.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTercero(t._id);
            successToast("Tercero eliminado");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  return (
    <>
      <DsModuleScreen
        title="Terceros"
        subtitle="Maestro unificado de clientes, proveedores y empleados"
        refreshing={refreshing}
        onRefresh={onRefresh}
        toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar nombre, NIT, email..." />}
      >
        <LedgerChipRow>
          {ROLES.map((r) => (
            <LedgerChip
              key={r || "all"}
              label={r ? ROLE_LABELS[r] : "Todos"}
              active={rol === r}
              onPress={() => setRol(rol === r ? "" : r)}
            />
          ))}
        </LedgerChipRow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 }}>
          <DsButton label="Nuevo" icon="add" compact onPress={() => { setEdit(null); setModalOpen(true); }} />
          <LedgerPrimaryBtn label="Importar" variant="secondary" onPress={onMigrate} loading={busy} />
          <LedgerPrimaryBtn label="Vincular" variant="secondary" onPress={onBackfill} disabled={busy} />
        </View>

        {loading ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Cargando...</Text>
        ) : rows.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Sin terceros.</Text>
        ) : (
          rows.map((t) => (
            <View key={t._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <Text style={{ fontWeight: "700", color: colors.primaryText }}>{t.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t.doc_number}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginVertical: 6 }}>
                {t.roles.map((r) => (
                  <LedgerStatusBadge key={r} label={ROLE_LABELS[r]} tone="neutral" />
                ))}
                {t.conflicto_revision ? <LedgerStatusBadge label="Conflicto" tone="bad" /> : null}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.email || "—"}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <LedgerPrimaryBtn label="Editar" variant="secondary" onPress={() => { setEdit(t); setModalOpen(true); }} />
                <LedgerPrimaryBtn label="Eliminar" variant="danger" onPress={() => onDelete(t)} />
              </View>
            </View>
          ))
        )}
        <NativePagination page={page} totalPages={totalPages} loading={loading} onChange={setPage} />
      </DsModuleScreen>

      <TerceroModalNative
        visible={modalOpen}
        tercero={edit}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); load(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10 },
});
