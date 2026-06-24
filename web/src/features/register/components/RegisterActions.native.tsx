import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { PortalIconName } from "../../../components/shared/PortalField.native";
import { useThemeColors } from "../../../theme/useThemeColors";

type RegisterPrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  iconLeft?: PortalIconName;
  iconRight?: PortalIconName;
  style?: ViewStyle;
};

export function RegisterPrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
  iconLeft,
  iconRight,
  style,
}: RegisterPrimaryButtonProps) {
  const colors = useThemeColors();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.buttonWrap,
        style,
        isDisabled ? styles.buttonDisabled : null,
        pressed && !isDisabled ? styles.buttonPressed : null,
      ]}
    >
      <LinearGradient
        colors={[colors.accent, colors.accentHover]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {loading ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              {loadingLabel ? <Text style={styles.label}>{loadingLabel}</Text> : null}
            </>
          ) : (
            <>
              {iconLeft ? <Ionicons name={iconLeft} size={18} color="#fff" /> : null}
              <Text style={styles.label}>{label}</Text>
              {iconRight ? <Ionicons name={iconRight} size={18} color="#fff" /> : null}
            </>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

type RegisterFormActionsProps = {
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  nextLoadingLabel?: string;
  showBack?: boolean;
  style?: ViewStyle;
};

/** Volver + Siguiente — mismo layout que el portal (columna en móvil). */
export function RegisterFormActions({
  onBack,
  backLabel = "Volver al Login",
  backDisabled = false,
  onNext,
  nextLabel,
  nextDisabled = false,
  nextLoading = false,
  nextLoadingLabel,
  showBack = true,
  style,
}: RegisterFormActionsProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.actions, { borderTopColor: colors.border }, style]}>
      {showBack && onBack ? (
        <RegisterPrimaryButton
          label={backLabel}
          iconLeft="arrow-back"
          onPress={onBack}
          disabled={backDisabled || nextLoading}
        />
      ) : null}
      <RegisterPrimaryButton
        label={nextLabel}
        iconRight="arrow-forward"
        onPress={onNext}
        disabled={nextDisabled}
        loading={nextLoading}
        loadingLabel={nextLoadingLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  buttonWrap: {
    width: "100%",
    borderRadius: 14,
    shadowColor: "rgba(90, 159, 180, 0.35)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    transform: [{ translateY: 1 }],
    shadowOpacity: 0.75,
  },
  gradient: {
    borderRadius: 14,
    overflow: "hidden",
  },
  content: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  actions: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    gap: 12,
  },
});
