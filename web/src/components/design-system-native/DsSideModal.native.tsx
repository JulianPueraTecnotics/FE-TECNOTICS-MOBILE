import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/useThemeColors";

type IoniconName = keyof typeof Ionicons.glyphMap;

type DsSideModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon?: IoniconName;
  children: ReactNode;
  /** Footer personalizado. Si se omite y se pasa `onSubmit`, se usa el footer por defecto. */
  footer?: ReactNode;
  closeDisabled?: boolean;
  wide?: boolean;
  scroll?: boolean;
  /** Footer por defecto (cancelar + acción primaria). */
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
};

/**
 * Modal lateral (drawer desde la derecha) con el estilo del portal web:
 * cabecera con borde inferior de acento, cuerpo desplazable y footer de acciones.
 */
export default function DsSideModal({
  visible,
  onClose,
  title,
  icon,
  children,
  footer,
  closeDisabled = false,
  wide = false,
  scroll = true,
  onSubmit,
  submitLabel = "Guardar",
  cancelLabel = "Cancelar",
  submitting = false,
  submitDisabled = false,
}: DsSideModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const screenW = Dimensions.get("window").width;
  const panelW = Math.min(screenW, wide ? 520 : 440);
  const translateX = useRef(new Animated.Value(panelW)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      translateX.setValue(panelW);
      overlayOpacity.setValue(0);
    }
  }, [visible, panelW, translateX, overlayOpacity]);

  const bodyTint = colors.bgSubtle;

  const defaultFooter =
    onSubmit != null ? (
      <>
        <Pressable
          style={[styles.btnGhost, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
          onPress={onClose}
          disabled={closeDisabled || submitting}
        >
          <Text style={[styles.btnGhostText, { color: colors.primaryText }]}>{cancelLabel}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.btnPrimary,
            { backgroundColor: colors.headerAccent, opacity: submitting || submitDisabled ? 0.6 : 1 },
          ]}
          onPress={onSubmit}
          disabled={submitting || submitDisabled}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>{submitLabel}</Text>
          )}
        </Pressable>
      </>
    ) : null;

  const footerContent = footer ?? defaultFooter;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => !closeDisabled && onClose()}>
      <View style={styles.root}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !closeDisabled && onClose()} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              width: panelW,
              backgroundColor: colors.cardBg,
              transform: [{ translateX }],
              paddingTop: insets.top,
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.headerAccent, backgroundColor: colors.cardBg }]}>
            <View style={styles.headerContent}>
              {icon ? <Ionicons name={icon} size={20} color={colors.headerAccent} /> : null}
              <Text style={[styles.title, { color: colors.primary }]} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Pressable
              style={[styles.closeBtn, { backgroundColor: `${colors.headerAccent}1a` }]}
              onPress={onClose}
              disabled={closeDisabled}
              accessibilityLabel="Cerrar"
              hitSlop={6}
            >
              <Ionicons name="close" size={20} color={colors.headerAccent} />
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={insets.top}
          >
            {scroll ? (
              <ScrollView
                style={[styles.body, { backgroundColor: bodyTint }]}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.body, styles.bodyContent, { backgroundColor: bodyTint }]}>{children}</View>
            )}

            {footerContent ? (
              <View
                style={[
                  styles.footer,
                  { borderTopColor: colors.border, backgroundColor: colors.cardBg, paddingBottom: 12 + insets.bottom },
                ]}
              >
                {footerContent}
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0, 20, 30, 0.45)" },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    shadowColor: "#002737",
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 3,
  },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  title: { fontSize: 18, fontWeight: "700", flexShrink: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  bodyContent: { padding: 18, gap: 14 },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnGhost: {
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnGhostText: { fontSize: 14, fontWeight: "600" },
  btnPrimary: {
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
