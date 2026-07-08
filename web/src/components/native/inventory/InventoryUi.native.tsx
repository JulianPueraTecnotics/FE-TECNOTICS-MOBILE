import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getAllItems, searchItems } from "../../../services/items.service";
import { useThemeColors } from "../../../theme/useThemeColors";
import { DsField, DsSideModal } from "../../design-system-native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../mobile/shellStyles.native";
import type { ItemData } from "../../../types";

type Props = {
  label: string;
  value: ItemData | null;
  onChange: (item: ItemData | null) => void;
};

export function InvFieldLabel({ children }: { children: string }) {
  const colors = useThemeColors();
  return <Text style={[styles.label, { color: colors.textMuted }]}>{children}</Text>;
}

export default function ItemPickerFieldNative({ label, value, onChange }: Props) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim();
        const res = q ? await searchItems(q, 1, 30) : await getAllItems(1, 30);
        if (!ignore) setResults(res?.items ?? []);
      } finally {
        if (!ignore) setLoading(false);
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [open, query]);

  return (
    <View style={styles.wrap}>
      <DsField label={label} icon="cube-outline">
        <Pressable onPress={() => setOpen(true)} style={styles.pickerBtn}>
          <Text style={{ color: value ? colors.primaryText : colors.textMuted, flex: 1 }} numberOfLines={1}>
            {value ? `${value.code ? `${value.code} · ` : ""}${value.name}` : "Seleccionar producto…"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
      </DsField>
      {value ? (
        <Pressable onPress={() => onChange(null)}>
          <Text style={{ color: colors.accent, fontSize: 12, marginTop: 4 }}>Quitar selección</Text>
        </Pressable>
      ) : null}

      <DsSideModal
        visible={open}
        onClose={() => setOpen(false)}
        title="Producto"
        icon="cube-outline"
      >
        <DsField
          icon="search-outline"
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar en catálogo…"
        />
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : (
          results.map((item) => (
            <Pressable
              key={item._id}
              onPress={() => {
                onChange(item);
                setOpen(false);
              }}
              style={[styles.row, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Text style={{ fontWeight: "600", color: colors.primaryText }}>{item.name}</Text>
              {item.code ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.code}</Text> : null}
            </Pressable>
          ))
        )}
      </DsSideModal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  pickerBtn: { flexDirection: "row", alignItems: "center", flex: 1, paddingHorizontal: 12, paddingVertical: 11, gap: 8 },
  row: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 12, marginBottom: 8 },
});
