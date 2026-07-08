import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { DsSideModal } from "../../design-system-native";
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
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title="Guardar como plantilla"
      icon="repeat-outline"
      closeDisabled={loading}
      submitting={loading}
      submitLabel="Guardar"
      onSubmit={() => onConfirm(recurrence)}
    >
      <Text style={{ color: colors.textMuted }}>Elige la recurrencia de emisión automática</Text>
      {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([value, label]) => (
        <Pressable
          key={value}
          onPress={() => setRecurrence(value)}
          style={[
            styles.option,
            {
              borderColor: recurrence === value ? colors.headerAccent : colors.border,
              backgroundColor: recurrence === value ? `${colors.headerAccent}12` : colors.cardBg,
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
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderRadius: SHELL_RADIUS.button },
});
