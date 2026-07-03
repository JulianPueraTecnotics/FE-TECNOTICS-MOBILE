import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TextInput, View, type ViewStyle } from "react-native";
import { SHELL_RADIUS } from "../mobile/shellStyles.native";
import { useThemeColors } from "../../theme/useThemeColors";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
};

/** Campo de búsqueda — paridad con `.ds-search` / filtros del portal web. */
export default function DsSearchField({ value, onChangeText, placeholder = "Buscar…", style }: Props) {
  const colors = useThemeColors();
  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.cardBg }, style]}>
      <Ionicons name="search-outline" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.primaryText }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 14 },
});
