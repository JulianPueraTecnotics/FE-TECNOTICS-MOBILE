import { Linking, StyleSheet, Text } from "react-native";
import { useParams } from "react-router-dom";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { ENV } from "../../../utils/global";

/** Firma PDF requiere canvas/DOM — abre el portal web para completar el paso. */
export default function ContinueMandatoNative() {
  const colors = useThemeColors();
  const { companyId } = useParams<{ companyId: string }>();
  const webUrl = companyId ? `${ENV.FE_URL}/continue/mandato/${companyId}` : ENV.FE_URL;

  return (
    <DsModuleScreen
      title="Contrato de mandato"
      subtitle="Firma digital del documento"
      headerActions={
        <DsButton
          label="Abrir portal"
          icon="open-outline"
          compact
          onPress={() => void Linking.openURL(webUrl)}
        />
      }
    >
      <Text style={[styles.text, { color: colors.textMuted }]}>
        La firma del PDF requiere el navegador web del portal. Pulsa el botón para continuar el registro en la
        versión web con la misma sesión.
      </Text>
      <DsButton label="Continuar en el portal web" icon="globe-outline" onPress={() => void Linking.openURL(webUrl)} />
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
});
