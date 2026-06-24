import { useCallback, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { signupStep2VerifyOTP } from "../../../services/register.service";
import { useThemeColors } from "../../../theme/useThemeColors";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import PortalOtpInput, {
  PortalOtpHeader,
  PortalOtpPasteHint,
} from "../../../components/shared/PortalOtpInput.native";
import { createRegisterStyles, RegisterPrimaryButton } from "./registerForm.native";

type Props = {
  companyId: string;
  email: string;
  onComplete: (contratoData: { public_id: string; url: string; original_name: string }) => void;
};

export default function Step2Native({ companyId, email, onComplete }: Props) {
  const colors = useThemeColors();
  const styles = createRegisterStyles(colors);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [contratoUrl, setContratoUrl] = useState<string | null>(null);
  const [contratoData, setContratoData] = useState<{
    public_id: string;
    url: string;
    original_name: string;
  } | null>(null);

  const handleSubmit = async () => {
    if (otp.length !== 6) {
      errorToast("Por favor ingresa el código completo de 6 dígitos");
      return;
    }

    setLoading(true);
    try {
      const response = await signupStep2VerifyOTP({
        companyId,
        OTP_recovery: parseInt(otp, 10),
      });
      successToast("OTP verificado correctamente");
      setContratoUrl(response.data.contrato_mandato.url);
      setContratoData(response.data.contrato_mandato);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al verificar OTP");
    } finally {
      setLoading(false);
    }
  };

  const inputsDisabled = loading || contratoUrl !== null;
  const handleOtpChange = useCallback((next: string) => setOtp(next), []);

  return (
    <View>
      <PortalOtpHeader email={email} />

      <PortalOtpInput
        value={otp}
        onChange={handleOtpChange}
        disabled={inputsDisabled}
        autoFocus
        style={{ marginBottom: 12 }}
      />

      <PortalOtpPasteHint disabled={inputsDisabled} />

      {!contratoUrl ? (
        <RegisterPrimaryButton
          label="Verificar Código"
          iconRight="arrow-forward"
          onPress={() => void handleSubmit()}
          disabled={loading || otp.length !== 6}
          loading={loading}
          loadingLabel="Verificando..."
          style={{ marginTop: 20 }}
        />
      ) : null}

      {contratoUrl && contratoData ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>¡Código verificado exitosamente!</Text>
          <Text style={styles.infoText}>
            Tu contrato de mandato ha sido generado. La firma se realizará más adelante mediante un
            enlace que te enviaremos por correo después de subir los documentos legales.
          </Text>
          <Pressable
            style={[styles.secondaryBtn, { marginTop: 12 }]}
            onPress={() => Linking.openURL(contratoUrl).catch(() => undefined)}
          >
            <Text style={styles.secondaryBtnText}>Ver / descargar contrato de mandato</Text>
          </Pressable>
          <RegisterPrimaryButton
            label="Continuar al Siguiente Paso (subir documentos)"
            iconRight="arrow-forward"
            onPress={() => onComplete(contratoData)}
            style={{ marginTop: 12 }}
          />
        </View>
      ) : null}
    </View>
  );
}
