import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { RECURRENCE_LABELS, type RecurrenceType } from "../../../types";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (recurrence: RecurrenceType) => void;
  loading?: boolean;
};

export default function TemplateRecurrenceModalNative({ visible, onClose, onConfirm, loading }: Props) {
  const colors = useThemeColors();
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.cardBg }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: colors.primary }]}>Guardar como plantilla</Text>
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>Elige la recurrencia de emisión automática</Text>
          <ScrollView style={{ maxHeight: 280 }}>
            {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setRecurrence(value)}
                style={[
                  styles.option,
                  {
                    borderColor: recurrence === value ? colors.headerAccent : colors.border,
                    backgroundColor: recurrence === value ? `${colors.headerAccent}12` : "transparent",
                  },
                ]}
              >
                <Ionicons
                  name={recurrence === value ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={recurrence === value ? colors.headerAccent : colors.textMuted}
                />
                <Text style={{ color: colors.primaryText, fontWeight: recurrence === value ? "600" : "400" }}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={[styles.btn, { borderColor: colors.border }]} onPress={onClose} disabled={loading}>
              <Text style={{ color: colors.primaryText }}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.headerAccent, opacity: loading ? 0.6 : 1 }]}
              onPress={() => onConfirm(recurrence)}
              disabled={loading}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Guardar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
  sheet: { borderRadius: SHELL_RADIUS.card, padding: 20, maxHeight: "80%" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderRadius: SHELL_RADIUS.button, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});
