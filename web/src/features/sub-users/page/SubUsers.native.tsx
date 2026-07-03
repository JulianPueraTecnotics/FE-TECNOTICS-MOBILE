import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import SubUserFormModalNative from "../../../components/native/forms/SubUserFormModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { getAllSubUsers, searchSubUsers } from "../../../services/sub-users.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import type { ISubUser } from "../../../types";

function formatDocument(docType: string, docNumber: string) {
  return `${docType} ${docNumber}`;
}

function fullName(u: ISubUser) {
  return `${u.name} ${u.last_name}`.trim();
}

export default function SubUsersNative() {
  const colors = useThemeColors();
  const [users, setUsers] = useState<ISubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ISubUser | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    let ignore = false;
    const hasData = users.length > 0;
    if (hasData) setFetching(true);
    else setLoading(true);

    (async () => {
      try {
        const q = debouncedSearch.trim();
        const response = q ? await searchSubUsers(q, page, 20) : await getAllSubUsers(page, 20);
        if (ignore || !response) return;
        setUsers(response.users);
        setTotalPages(response.pagination.totalPages);
      } catch (error) {
        if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar usuarios");
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
  }, [page, debouncedSearch, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <DsModuleScreen
        title="Usuarios"
        subtitle="Gestiona los usuarios de tu empresa"
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          setRefreshKey((k) => k + 1);
        }}
        toolbar={
          <>
            <DsSearchField
              value={searchTerm}
              onChangeText={(v) => {
                setSearchTerm(v);
                setPage(1);
              }}
              placeholder="Buscar por nombre, email o documento…"
            />
            {fetching ? <ActivityIndicator size="small" color={colors.headerAccent} /> : null}
          </>
        }
        headerActions={
          <DsButton
            label="Nuevo"
            icon="add"
            compact
            onPress={() => {
              setSelectedUser(null);
              setModalOpen(true);
            }}
          />
        }
      >
        {users.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No hay usuarios registrados.</Text>
        ) : (
          users.map((u) => {
            const active = u.active !== false;
            return (
              <Pressable
                key={u._id}
                onPress={() => {
                  setSelectedUser(u);
                  setModalOpen(true);
                }}
                style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.cardName, { color: colors.primaryText }]}>{fullName(u)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: active ? "#dcfce7" : "#fee2e2" }]}>
                    <Text style={{ color: active ? "#166534" : "#991b1b", fontSize: 11, fontWeight: "700" }}>
                      {active ? "Activo" : "Inactivo"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{u.email}</Text>
                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{formatDocument(u.doc_type, u.doc_number)}</Text>
              </Pressable>
            );
          })
        )}

        <NativePagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </DsModuleScreen>

      <SubUserFormModalNative
        visible={modalOpen}
        subUser={selectedUser}
        onClose={() => {
          setModalOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: "center", marginTop: 40, fontSize: 15 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: "700", flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: SHELL_RADIUS.button },
  cardMeta: { fontSize: 13, marginTop: 2 },
});
