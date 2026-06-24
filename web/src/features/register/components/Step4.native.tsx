import { useState } from "react";
import { Text, View } from "react-native";
import { signupStep4SendToSimba } from "../../../services/register.service";
import { useThemeColors } from "../../../theme/useThemeColors";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { createRegisterStyles, RegisterPrimaryButton } from "./registerForm.native";

type Props = {
  companyId: string;
  onComplete: () => void;
};

export default function Step4Native({ companyId, onComplete }: Props) {
  const colors = useThemeColors();
  const styles = createRegisterStyles(colors);
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await signupStep4SendToSimba({ companyId });
      successToast(response.message);
      setIsCompleted(true);
      setTimeout(() => onComplete(), 2000);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al enviar a SIMBA");
    } finally {
      setLoading(false);
    }
  };

  if (isCompleted) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 16 }}>
        <Text style={[styles.sectionTitle, { textAlign: "center" }]}>
          ¡Registro completado exitosamente!
        </Text>
        <Text style={[styles.infoText, { textAlign: "center", marginTop: 8 }]}>
          Tu información ha sido enviada a SIMBA. Recibirás un correo cuando tu cuenta esté activa.
        </Text>
        <Text style={[styles.hint, { marginTop: 16 }]}>
          Serás redirigido al inicio de sesión en unos segundos…
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Paso final: Enviar a SIMBA</Text>
      <Text style={[styles.infoText, { marginBottom: 16 }]}>
        Estamos listos para enviar tu documentación al sistema SIMBA de la DIAN para activar tu
        facturación electrónica.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Documentación completa</Text>
        <Text style={styles.infoText}>
          Todos tus documentos han sido verificados y están listos para ser procesados.
        </Text>
      </View>

      <View style={[styles.infoBox, { marginTop: 12 }]}>
        <Text style={styles.infoTitle}>Tiempo de procesamiento</Text>
        <Text style={styles.infoText}>
          El proceso de tokenización puede tomar entre 24 y 48 horas hábiles.
        </Text>
      </View>

      <View style={[styles.infoBox, { marginTop: 12 }]}>
        <Text style={styles.infoTitle}>Importante</Text>
        <Text style={styles.infoText}>
          Una vez enviada la información a SIMBA, no podrás modificar los datos de tu empresa.
          Asegúrate de que toda la información esté correcta antes de continuar.
        </Text>
      </View>

      <RegisterPrimaryButton
        label="Enviar a SIMBA y Finalizar"
        iconLeft="send"
        onPress={() => void handleSubmit()}
        disabled={loading}
        loading={loading}
        loadingLabel="Enviando a SIMBA..."
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
