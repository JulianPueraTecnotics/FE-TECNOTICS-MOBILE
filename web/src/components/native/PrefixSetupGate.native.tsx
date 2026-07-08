import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigate } from "react-router-dom";
import { useNativePrivateInsets } from "../mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../mobile/shellStyles.native";
import { useThemeColors } from "../../theme/useThemeColors";
import { PATHS } from "../../router/paths.contants";

type Props = {
  onBack?: () => void;
};

/**
 * Pantalla de bloqueo antes de facturar — paridad con fe-billing `tecnotics-account-setup`.
 * Se muestra cuando la cuenta no tiene prefijos (resoluciones) configurados.
 */
export default function PrefixSetupGateNative({ onBack }: Props) {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const insets = useNativePrivateInsets();

  return (
    <View style={[styles.page, { backgroundColor: colors.pageBg, paddingTop: insets.paddingTop, paddingBottom: insets.paddingBottom }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.primary }]}>
          Configura los prefijos de facturación
        </Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>
          Para empezar a emitir documentos electrónicos debes configurar los prefijos
          (resoluciones) de facturación de tu cuenta.
        </Text>
        <Pressable
          style={[styles.btn, { backgroundColor: colors.headerAccent }]}
          onPress={() => navigate(`${PATHS.CONFIGURATION}?sec=facturacion`)}
        >
          <Text style={styles.btnText}>Configurar prefijos</Text>
        </Pressable>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backLink}>
            <Text style={[styles.backText, { color: colors.textMuted }]}>Volver</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  content: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 32,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  btn: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: SHELL_RADIUS.button,
    minWidth: 220,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  backLink: {
    marginTop: 8,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
  },
});
