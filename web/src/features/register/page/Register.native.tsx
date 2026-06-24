import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigate } from "react-router-dom";
import KeyboardFormScroll from "../../../components/shared/KeyboardFormScroll.native";
import AuthScreenLayout from "../../../components/shared/AuthScreenLayout.native";
import { PATHS } from "../../../router/paths.contants";
import { useThemeColors } from "../../../theme/useThemeColors";
import {
  clearRegisterProgress,
  getRegisterProgress,
  hasRecentProgress,
  saveRegisterProgress,
} from "../../../utils/registerStorage";
import { removeItemSync } from "../../../utils/storage";
import { successToast } from "../../../components/shared/toast/toasts";
import RegisterProgress from "../components/RegisterProgress.native";
import Step1Native from "../components/Step1.native";
import Step2Native from "../components/Step2.native";
import Step3Native from "../components/Step3.native";
import Step4Native from "../components/Step4.native";

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const colors = useThemeColors();
  const savedProgress = getRegisterProgress();

  const [currentStep, setCurrentStep] = useState(savedProgress.currentStep || 1);
  const [companyId, setCompanyId] = useState(savedProgress.company_id || "");
  const [email, setEmail] = useState(savedProgress.email || "");

  useEffect(() => {
    if (hasRecentProgress() && savedProgress.currentStep > 1) {
      successToast(`Progreso recuperado. Continuando desde el paso ${savedProgress.currentStep}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStep1Complete = (id: string, emailValue: string, razonSocial: string) => {
    setCompanyId(id);
    setEmail(emailValue);
    setCurrentStep(2);
    saveRegisterProgress({
      currentStep: 2,
      company_id: id,
      email: emailValue,
      razon_social: razonSocial,
    });
  };

  const handleStep2Complete = (contratoData: {
    public_id: string;
    url: string;
    original_name: string;
  }) => {
    setCurrentStep(3);
    saveRegisterProgress({ currentStep: 3, contrato_mandato: contratoData });
  };

  const handleStep3Complete = () => {
    setCurrentStep(4);
    saveRegisterProgress({ currentStep: 4, documents_uploaded: true });
  };

  const handleStep4Complete = () => {
    successToast("¡Registro completado exitosamente!");
    clearRegisterProgress();
    removeItemSync("signed_contract_mandato");
    removeItemSync("signed_contract_name");
    navigate(PATHS.LOGIN);
  };

  return (
    <AuthScreenLayout>
      <KeyboardFormScroll
        style={{ backgroundColor: colors.pageBg }}
        contentContainerStyle={styles.scroll}
      >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.primary }]}>Registro de Empresa</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Completa los siguientes pasos para registrar tu empresa
        </Text>

        <RegisterProgress currentStep={currentStep} />

        {currentStep === 1 ? (
          <Step1Native
            onComplete={handleStep1Complete}
            onBackToLogin={() => navigate(PATHS.LOGIN)}
          />
        ) : null}
        {currentStep === 2 && companyId ? (
          <Step2Native companyId={companyId} email={email} onComplete={handleStep2Complete} />
        ) : null}
        {currentStep === 3 && companyId ? (
          <Step3Native companyId={companyId} onComplete={handleStep3Complete} />
        ) : null}
        {currentStep === 4 && companyId ? (
          <Step4Native companyId={companyId} onComplete={handleStep4Complete} />
        ) : null}
      </View>
      </KeyboardFormScroll>
    </AuthScreenLayout>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: "center", marginBottom: 8, lineHeight: 20 },
});

export default RegisterPage;
