import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../store/theme.context";
import { useThemeColors } from "../../theme/useThemeColors";

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string;
  autoFocus?: boolean;
  style?: ViewStyle;
};

function sanitizeOtp(raw: string, length: number): string {
  return raw.replace(/\D/g, "").slice(0, length);
}

function digitsFromValue(value: string, length: number): string[] {
  const clean = sanitizeOtp(value, length);
  return Array.from({ length }, (_, index) => clean[index] ?? "");
}

/** OTP estable: un solo TextInput oculto + cajas visuales (evita crashes y desbordes). */
function PortalOtpInputComponent({
  value,
  onChange,
  length = 6,
  disabled = false,
  error,
  autoFocus = false,
  style,
}: Props) {
  const colors = useThemeColors();
  const { theme } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const safeValue = useMemo(() => sanitizeOtp(value, length), [length, value]);
  const digits = useMemo(() => digitsFromValue(safeValue, length), [length, safeValue]);

  const activeIndex = useMemo(() => {
    if (!focused) return -1;
    if (safeValue.length >= length) return length - 1;
    return safeValue.length;
  }, [focused, length, safeValue.length]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoFocus, disabled]);

  const handleChangeText = useCallback(
    (text: string) => {
      const next = sanitizeOtp(text, length);
      if (next !== safeValue) {
        onChange(next);
      }
    },
    [length, onChange, safeValue]
  );

  const focusInput = useCallback(() => {
    if (disabled) return;
    inputRef.current?.focus();
  }, [disabled]);

  const borderDefault = theme === "dark" ? "rgba(90, 159, 180, 0.28)" : "#e2e8f0";
  const bgDefault = colors.cardBg;
  const bgDisabled = colors.bgSubtle;

  return (
    <View style={[styles.container, style]}>
      <TextInput
        ref={inputRef}
        value={safeValue}
        onChangeText={handleChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        editable={!disabled}
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel={`Código de ${length} dígitos`}
        importantForAutofill="yes"
      />

      <View style={styles.row} pointerEvents={disabled ? "none" : "auto"}>
        {digits.map((digit, index) => {
          const isActive = activeIndex === index;
          const filled = digit.length > 0;
          const borderColor = error
            ? "#ef4444"
            : isActive
              ? colors.secondary
              : filled
                ? colors.accent
                : borderDefault;

          return (
            <Pressable
              key={index}
              onPress={focusInput}
              style={[
                styles.box,
                {
                  borderColor,
                  backgroundColor: disabled ? bgDisabled : bgDefault,
                },
                isActive && !error
                  ? {
                      shadowColor: colors.secondary,
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: 0.18,
                      shadowRadius: 6,
                      elevation: 2,
                    }
                  : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Dígito ${index + 1} de ${length}`}
            >
              {digit ? (
                <Text style={[styles.digit, { color: colors.primaryText }]}>{digit}</Text>
              ) : isActive && focused ? (
                <View style={[styles.cursor, { backgroundColor: colors.secondary }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const PortalOtpInput = memo(PortalOtpInputComponent);
export default PortalOtpInput;

type OtpHeaderProps = {
  email: string;
  title?: string;
  style?: ViewStyle;
};

export function PortalOtpHeader({
  email,
  title = "Verifica tu correo electrónico",
  style,
}: OtpHeaderProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.header, style]}>
      <View style={[styles.headerIcon, { backgroundColor: colors.primary }]}>
        <Ionicons name="mail-open-outline" size={32} color="#fff" />
      </View>
      <Text style={[styles.headerTitle, { color: colors.primary }]}>{title}</Text>
      <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
        Hemos enviado un código de 6 dígitos a{" "}
        <Text style={[styles.headerEmail, { color: colors.secondary }]}>{email}</Text>
      </Text>
    </View>
  );
}

export function PortalOtpPasteHint({ disabled }: { disabled?: boolean }) {
  const colors = useThemeColors();

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.pasteHint,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.bgSubtle : "transparent",
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Ionicons name="clipboard-outline" size={16} color={colors.accent} />
      <Text style={[styles.pasteHintText, { color: colors.textMuted }]}>
        Puedes pegar el código completo en cualquier casilla
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignSelf: "stretch",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 6,
  },
  box: {
    flex: 1,
    minWidth: 34,
    maxWidth: 52,
    aspectRatio: 0.88,
    maxHeight: 58,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  cursor: {
    width: 2,
    height: 22,
    borderRadius: 1,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
    width: "100%",
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#002737",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  headerSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 4,
    width: "100%",
  },
  headerEmail: {
    fontWeight: "700",
  },
  pasteHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    width: "100%",
  },
  pasteHintText: {
    fontSize: 12,
    textAlign: "center",
    flexShrink: 1,
  },
});
