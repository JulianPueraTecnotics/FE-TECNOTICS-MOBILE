import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useThemeColors } from "../../theme/useThemeColors";

type IoniconName = keyof typeof Ionicons.glyphMap;

type DsFieldProps = {
  label?: string;
  icon?: IoniconName;
  hint?: string;
  /** Control personalizado (Picker, Select…). Si se omite se renderiza un TextInput. */
  children?: ReactNode;
  /** Marca el campo como obligatorio (añade * al label). */
  required?: boolean;
} & Omit<TextInputProps, "style">;

/**
 * Campo con ícono al estilo del portal web: etiqueta arriba, contenedor con
 * caja de ícono a la izquierda y control (input o children) a la derecha.
 */
export default function DsField({
  label,
  icon,
  hint,
  children,
  required,
  ...inputProps
}: DsFieldProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={[styles.label, { color: colors.primaryText }]}>
          {label}
          {required ? <Text style={{ color: "#dc2626" }}> *</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.control, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
        {icon ? (
          <View style={[styles.iconBox, { backgroundColor: `${colors.headerAccent}14`, borderRightColor: colors.border }]}>
            <Ionicons name={icon} size={17} color={colors.headerAccent} />
          </View>
        ) : null}
        {children ? (
          <View style={styles.customControl}>{children}</View>
        ) : (
          <TextInput
            {...inputProps}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, inputProps.multiline ? styles.inputMulti : null, { color: colors.primaryText }]}
          />
        )}
      </View>
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, minWidth: 0 },
  label: { fontSize: 13, fontWeight: "600" },
  control: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 44,
  },
  iconBox: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMulti: { minHeight: 84, paddingTop: 10, textAlignVertical: "top" },
  customControl: { flex: 1, minWidth: 0, justifyContent: "center" },
  hint: { fontSize: 12, lineHeight: 16 },
});
