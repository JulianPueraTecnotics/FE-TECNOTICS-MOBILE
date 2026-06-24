import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";

type Props = {
  page: number;
  totalPages: number;
  loading?: boolean;
  onChange: (page: number) => void;
};

export default function NativePagination({ page, totalPages, loading, onChange }: Props) {
  const colors = useThemeColors();
  if (totalPages <= 1) return null;

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Pressable
        style={[styles.btn, { borderColor: colors.border, opacity: page === 1 || loading ? 0.5 : 1 }]}
        disabled={page === 1 || loading}
        onPress={() => onChange(page - 1)}
      >
        <Text style={[styles.btnText, { color: colors.primaryText }]}>Anterior</Text>
      </Pressable>
      <Text style={[styles.info, { color: colors.textMuted }]}>
        Página {page} de {totalPages}
        {loading ? " · Actualizando..." : ""}
      </Text>
      <Pressable
        style={[
          styles.btn,
          { borderColor: colors.border, opacity: page === totalPages || loading ? 0.5 : 1 },
        ]}
        disabled={page === totalPages || loading}
        onPress={() => onChange(page + 1)}
      >
        <Text style={[styles.btnText, { color: colors.primaryText }]}>Siguiente</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  btnText: { fontSize: 13, fontWeight: "600" },
  info: { fontSize: 13, fontWeight: "500", flex: 1, textAlign: "center" },
});
