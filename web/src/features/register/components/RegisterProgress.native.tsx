import { Text, View } from "react-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { createRegisterStyles } from "./registerForm.native";

const STEP_LABELS = ["Información", "Verificación", "Documentos", "Finalizar"];

type Props = { currentStep: number };

export default function RegisterProgress({ currentStep }: Props) {
  const colors = useThemeColors();
  const styles = createRegisterStyles(colors);

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        {[1, 2, 3, 4].map((step) => {
          const active = currentStep >= step;
          return (
            <View key={step} style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? colors.primary : colors.cardBg,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: active ? "#fff" : colors.textMuted, fontWeight: "700" }}>
                  {step}
                </Text>
              </View>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  textAlign: "center",
                  color: active ? colors.primaryText : colors.textMuted,
                  fontWeight: active ? "600" : "400",
                }}
              >
                {STEP_LABELS[step - 1]}
              </Text>
            </View>
          );
        })}
      </View>
      <View
        style={{
          marginTop: 12,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${((currentStep - 1) / 3) * 100}%`,
            height: "100%",
            backgroundColor: colors.accent,
          }}
        />
      </View>
      <Text style={[styles.hint, { marginTop: 8 }]}>Paso {currentStep} de 4</Text>
    </View>
  );
}
