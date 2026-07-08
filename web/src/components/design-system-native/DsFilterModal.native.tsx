import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useThemeColors } from "../../theme/useThemeColors";
import DsSideModal from "./DsSideModal.native";

type DsFilterModalProps = {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
  onClear: () => void;
  hasActiveFilters?: boolean;
  title?: string;
  children: ReactNode;
};

/**
 * Modal lateral de filtros al estilo del portal: cuerpo de campos y footer con
 * "Limpiar" (solo si hay filtros activos) y "Aplicar filtros".
 */
export default function DsFilterModal({
  visible,
  onClose,
  onApply,
  onClear,
  hasActiveFilters = false,
  title = "Filtros",
  children,
}: DsFilterModalProps) {
  const colors = useThemeColors();

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={title}
      icon="filter"
      footer={
        <>
          {hasActiveFilters ? (
            <Pressable
              style={[styles.btnGhost, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
              onPress={onClear}
            >
              <Ionicons name="close-circle-outline" size={17} color={colors.primaryText} />
              <Text style={[styles.btnGhostText, { color: colors.primaryText }]}>Limpiar</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.btnPrimary, { backgroundColor: colors.headerAccent }]} onPress={onApply}>
            <Ionicons name="checkmark" size={17} color="#fff" />
            <Text style={styles.btnPrimaryText}>Aplicar filtros</Text>
          </Pressable>
        </>
      }
    >
      {children}
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  btnGhost: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 96,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnGhostText: { fontSize: 14, fontWeight: "600" },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 120,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
