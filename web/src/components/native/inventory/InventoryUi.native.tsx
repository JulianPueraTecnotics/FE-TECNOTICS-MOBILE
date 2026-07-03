import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getAllItems, searchItems } from "../../../services/items.service";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../mobile/useNativePrivateInsets.native";
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

export function InvTextInput({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  multiline?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      keyboardType={keyboardType}
      multiline={multiline}
      style={[
        styles.input,
        multiline ? { minHeight: 72, textAlignVertical: "top" } : null,
        { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.pageBg },
      ]}
    />
  );
}

export default function ItemPickerFieldNative({ label, value, onChange }: Props) {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
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
      <InvFieldLabel>{label}</InvFieldLabel>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.pickerBtn, { borderColor: colors.border, backgroundColor: colors.pageBg }]}
      >
        <Text style={{ color: value ? colors.primaryText : colors.textMuted, flex: 1 }} numberOfLines={1}>
          {value ? `${value.code ? `${value.code} · ` : ""}${value.name}` : "Seleccionar producto…"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {value ? (
        <Pressable onPress={() => onChange(null)}>
          <Text style={{ color: colors.accent, fontSize: 12, marginTop: 4 }}>Quitar selección</Text>
        </Pressable>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.pageBg, paddingTop: insets.paddingTop }}>
          <View style={[styles.modalHead, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setOpen(false)}>
              <Ionicons name="close" size={26} color={colors.primaryText} />
            </Pressable>
            <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 17 }}>Producto</Text>
            <View style={{ width: 26 }} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar en catálogo…"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { margin: 16, borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
          />
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}>
              {results.map((item) => (
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
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  pickerBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 12, marginBottom: 8 },
});
