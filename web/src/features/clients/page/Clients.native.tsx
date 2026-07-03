import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ClientFormModalNative from "../../../components/native/forms/ClientFormModal.native";
import { DsButton, DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { deleteClient, getAllClients, searchClients } from "../../../services/clients.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import type { IExternUser } from "../../../types";

function formatDocument(client: IExternUser): string {
  const dv = client.doc_number_dv ? `-${client.doc_number_dv}` : "";
  return `${client.doc_type} ${client.doc_number}${dv}`;
}

function formatAddress(address: IExternUser["address"]): string {
  if (address == null) return "N/A";
  if (typeof address === "string") return address || "N/A";
  return (address as { value?: string }).value || "N/A";
}

export default function ClientsNative() {
  const colors = useThemeColors();
  const [clients, setClients] = useState<IExternUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<IExternUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    let ignore = false;
    const hasData = clients.length > 0;
    if (hasData) setFetching(true);
    else setLoading(true);

    (async () => {
      try {
        const q = debouncedSearch.trim();
        const response = q
          ? await searchClients(q, page, 20)
          : await getAllClients(page, 20);
        if (ignore || !response) return;
        setClients(response.clients);
        setTotalPages(response.pagination.totalPages);
      } catch (error) {
        if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar clientes");
      } finally {
        if (!ignore) {
          setLoading(false);
          setFetching(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleDelete = async (client: IExternUser) => {
    setDeletingId(client._id);
    try {
      await deleteClient(client._id);
      successToast("Cliente eliminado");
      if (clients.length === 1 && page > 1) setPage((p) => p - 1);
      else setRefreshKey((k) => k + 1);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <DsModuleScreen
        title="Clientes"
        subtitle="Gestiona tu base de clientes"
        loading={loading && clients.length === 0}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          setRefreshKey((k) => k + 1);
        }}
        toolbar={
          <>
            <DsSearchField
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Buscar cliente..."
              style={{ flex: 1 }}
            />
            <DsButton
              label=""
              icon="add"
              compact
              onPress={() => {
                setSelectedClient(null);
                setModalOpen(true);
              }}
              style={{ minWidth: 44, paddingHorizontal: 0 }}
            />
          </>
        }
      >
        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={setPage} />

        {clients.length === 0 && !loading ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No hay clientes para mostrar</Text>
        ) : (
          clients.map((client) => (
            <View
              key={client._id}
              style={[
                styles.card,
                getSoftCardShadow(colors),
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.name, { color: colors.primary }]}>{client.name}</Text>
              <Text style={[styles.line, { color: colors.primaryText }]}>{formatDocument(client)}</Text>
              <Text style={[styles.line, { color: colors.textMuted }]}>{client.email || "Sin email"}</Text>
              <Text style={[styles.line, { color: colors.textMuted }]}>{client.phone || "Sin teléfono"}</Text>
              <Text style={[styles.line, { color: colors.textMuted }]} numberOfLines={2}>
                {formatAddress(client.address)}
              </Text>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setSelectedClient(client);
                    setModalOpen(true);
                  }}
                >
                  <Ionicons name="create-outline" size={16} color={colors.headerAccent} />
                  <Text style={[styles.actionText, { color: colors.headerAccent }]}>Editar</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { borderColor: colors.border, opacity: deletingId === client._id ? 0.6 : 1 }]}
                  disabled={deletingId === client._id}
                  onPress={() => void handleDelete(client)}
                >
                  {deletingId === client._id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  )}
                  <Text style={[styles.actionText, { color: "#ef4444" }]}>Eliminar</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={setPage} />
      </DsModuleScreen>

      <ClientFormModalNative
        visible={modalOpen}
        client={selectedClient}
        onClose={() => {
          setModalOpen(false);
          setSelectedClient(null);
        }}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: "center", marginTop: 32, fontSize: 15 },
  card: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.card,
    padding: 14,
    marginBottom: 12,
    gap: 4,
  },
  name: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  line: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  actionText: { fontSize: 12, fontWeight: "600" },
});
