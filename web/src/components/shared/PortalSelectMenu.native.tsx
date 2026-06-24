import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { NativeThemeColors } from "../../theme/theme.native";

export type SelectMenuItem = { label: string; value: string };

type Props = {
  open: boolean;
  title?: string;
  value: string;
  items: SelectMenuItem[];
  colors: NativeThemeColors;
  onClose: () => void;
  onSelect: (value: string) => void;
};

/** Menú flotante — solo se monta cuando está abierto para no crashear al escribir en otros campos. */
export default function PortalSelectMenu({
  open,
  title,
  value,
  items,
  colors,
  onClose,
  onSelect,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();

  if (!open) return null;

  const selectableItems = items.filter((item) => item.value !== "");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar menú" />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
              maxHeight: Math.min(360, windowHeight * 0.55),
            },
          ]}
        >
          {title ? (
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.headerText, { color: colors.primary }]}>
                {title.replace(/\s*\*$/, "")}
              </Text>
            </View>
          ) : null}
          <ScrollView
            style={[styles.list, { maxHeight: Math.min(300, windowHeight * 0.45) }]}
            keyboardShouldPersistTaps="handled"
          >
            {selectableItems.map((item) => {
              const active = item.value === value;
              return (
                <Pressable
                  key={item.value}
                  style={[
                    styles.item,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: active ? colors.bgSubtle : colors.cardBg,
                    },
                  ]}
                  onPress={() => onSelect(item.value)}
                >
                  <Text
                    style={[
                      styles.itemText,
                      { color: active ? colors.accent : colors.primaryText },
                      active ? styles.itemTextActive : null,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 15,
    fontWeight: "700",
  },
  list: {
    maxHeight: 300,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  itemTextActive: {
    fontWeight: "700",
  },
});
