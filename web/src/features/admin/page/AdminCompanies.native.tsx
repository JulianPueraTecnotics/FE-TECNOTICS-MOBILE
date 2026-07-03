import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-dom";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { errorToast } from "../../../components/shared/toast/toasts";
import { PATHS } from "../../../router/paths.contants";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { adminListCompanies, type AdminCompanyListItem } from "../services/admin_companies.service";

const PAGE_SIZE = 20;

export default function AdminCompaniesNative() {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminListCompanies({ page, limit: PAGE_SIZE, search: debounced })
      .then((data) => {
        if (!active) return;
        setCompanies(data.companies ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
      })
      .catch((e) => {
        if (!active) return;
        errorToast(e instanceof Error ? e.message : "Error al listar empresas");
        setCompanies([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => { active = false; };
  }, [page, debounced, refreshKey]);

  return (
    <DsModuleScreen
      title="Empresas"
      subtitle={`${total} registrada(s)`}
      loading={loading && companies.length === 0}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setRefreshKey((k) => k + 1);
      }}
      toolbar={
        <DsSearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar razón social, correo o NIT…"
        />
      }
    >
      <NativePagination page={page} totalPages={pages} loading={loading} onChange={setPage} />

      {loading && companies.length > 0 ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}

      {companies.length === 0 && !loading ? (
        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 24 }}>
          No se encontraron empresas
        </Text>
      ) : (
        companies.map((c) => (
          <Pressable
            key={c._id}
            onPress={() => navigate(PATHS.ADMIN_COMPANY_DETAIL(c._id))}
            style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}
          >
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>{c.razon_social || "—"}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{c.email}</Text>
            <View style={styles.meta}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {c.doc_number}{c.doc_number_dv ? `-${c.doc_number_dv}` : ""}
              </Text>
              <View style={[styles.badge, { backgroundColor: c.active ? "#d4edda" : "#f8d7da" }]}>
                <Text style={{ fontSize: 11, color: c.active ? "#155724" : "#721c24" }}>{c.active ? "Activa" : "Inactiva"}</Text>
              </View>
            </View>
            {c.stats ? (
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                {c.stats.facturas} facturas · {c.stats.clientes} clientes · {c.stats.items} ítems
              </Text>
            ) : null}
          </Pressable>
        ))
      )}
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 12 },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: SHELL_RADIUS.button },
});
