import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useMemo, useState, type ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../store/theme.context";
import type { NativeThemeColors } from "../../theme/theme.native";
import { useThemeColors } from "../../theme/useThemeColors";
import PortalSelectMenu from "./PortalSelectMenu.native";

export type PortalIconName = ComponentProps<typeof Ionicons>["name"];

const ICON_SIZE = 17;
const ICON_LEFT = 14;
const ICON_GAP = 10;
const PADDING_X = 14;
const PADDING_LEFT = PADDING_X + ICON_SIZE + ICON_GAP;
const CONTROL_MIN_HEIGHT = 44;
const RADIUS = 12;
const FONT_SIZE = 14;

const baseStyles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  control: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    minHeight: CONTROL_MIN_HEIGHT,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingRight: PADDING_X,
  },
  icon: {
    position: "absolute",
    left: ICON_LEFT,
    zIndex: 1,
  },
  input: {
    flex: 1,
    minHeight: CONTROL_MIN_HEIGHT,
    paddingVertical: 10,
    paddingLeft: PADDING_LEFT,
    paddingRight: 8,
    fontSize: FONT_SIZE,
    fontWeight: "500",
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 4,
  },
  toggleBtn: {
    padding: 4,
  },
  statusOk: { color: "#059669" },
  statusError: { color: "#ef4444" },
  errorText: { color: "#ef4444", fontSize: 12, marginTop: 4 },
  selectValue: {
    flex: 1,
    minHeight: CONTROL_MIN_HEIGHT,
    paddingVertical: 10,
    paddingLeft: PADDING_LEFT,
    paddingRight: 8,
    fontSize: FONT_SIZE,
    fontWeight: "500",
    textAlignVertical: "center",
  },
  chevron: {
    marginRight: 2,
  },
});

function portalInputTokens(
  colors: NativeThemeColors,
  theme: "light" | "dark",
  focused: boolean,
  hasError: boolean
) {
  const accent = colors.accent;
  const borderDefault = theme === "dark" ? "rgba(90, 159, 180, 0.22)" : "rgba(0, 39, 55, 0.12)";
  const bgDefault = theme === "dark" ? "#001828" : "rgba(248, 250, 252, 0.95)";
  const bgFocus = theme === "dark" ? "#002737" : colors.cardBg;
  const placeholder = theme === "dark" ? "rgba(148, 163, 184, 0.55)" : "rgba(15, 23, 42, 0.42)";

  return {
    borderColor: hasError ? "#ef4444" : focused ? accent : borderDefault,
    backgroundColor: focused ? bgFocus : bgDefault,
    iconColor: accent,
    iconOpacity: focused ? 1 : 0.88,
    placeholder,
  };
}

type PortalTextFieldProps = TextInputProps & {
  label?: string;
  icon: PortalIconName;
  error?: string;
  isValid?: boolean;
  containerStyle?: ViewStyle;
};

function PortalTextFieldComponent({
  label,
  icon,
  error,
  isValid,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: PortalTextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { theme } = useTheme();
  const colors = useThemeColors();
  const tokens = portalInputTokens(colors, theme, focused, !!error);

  return (
    <View style={[baseStyles.field, containerStyle]}>
      {label ? <Text style={[baseStyles.label, { color: colors.primaryText }]}>{label}</Text> : null}
      <View
        style={[
          baseStyles.control,
          {
            borderColor: tokens.borderColor,
            backgroundColor: tokens.backgroundColor,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={ICON_SIZE}
          color={tokens.iconColor}
          style={[baseStyles.icon, { opacity: tokens.iconOpacity }]}
          pointerEvents="none"
        />
        <TextInput
          {...rest}
          style={[baseStyles.input, { color: colors.primaryText }, style]}
          placeholderTextColor={tokens.placeholder}
          underlineColorAndroid="transparent"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {isValid === true && !error ? (
          <View style={baseStyles.trailing}>
            <Ionicons name="checkmark-circle" size={18} style={baseStyles.statusOk} />
          </View>
        ) : null}
      </View>
      {error ? <Text style={baseStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

export const PortalTextField = memo(PortalTextFieldComponent);

type PortalPasswordFieldProps = Omit<PortalTextFieldProps, "secureTextEntry"> & {
  showPassword: boolean;
  onTogglePassword: () => void;
};

function PortalPasswordFieldComponent({
  showPassword,
  onTogglePassword,
  error,
  isValid,
  label,
  icon = "lock-closed-outline",
  onFocus,
  onBlur,
  style,
  containerStyle,
  ...rest
}: PortalPasswordFieldProps) {
  const [focused, setFocused] = useState(false);
  const { theme } = useTheme();
  const colors = useThemeColors();
  const tokens = portalInputTokens(colors, theme, focused, !!error);

  return (
    <View style={[baseStyles.field, containerStyle]}>
      {label ? <Text style={[baseStyles.label, { color: colors.primaryText }]}>{label}</Text> : null}
      <View
        style={[
          baseStyles.control,
          {
            borderColor: tokens.borderColor,
            backgroundColor: tokens.backgroundColor,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={ICON_SIZE}
          color={tokens.iconColor}
          style={[baseStyles.icon, { opacity: tokens.iconOpacity }]}
          pointerEvents="none"
        />
        <TextInput
          {...rest}
          style={[baseStyles.input, { color: colors.primaryText, paddingRight: 44 }, style]}
          secureTextEntry={!showPassword}
          placeholderTextColor={tokens.placeholder}
          underlineColorAndroid="transparent"
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        <View style={baseStyles.trailing}>
          {isValid === true && !error ? (
            <Ionicons name="checkmark-circle" size={18} style={baseStyles.statusOk} />
          ) : null}
          <Pressable
            style={baseStyles.toggleBtn}
            onPress={onTogglePassword}
            accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={tokens.iconColor}
            />
          </Pressable>
        </View>
      </View>
      {error ? <Text style={baseStyles.errorText}>{error}</Text> : null}
    </View>
  );
}

export const PortalPasswordField = memo(PortalPasswordFieldComponent);

type PortalPickerFieldProps = {
  label?: string;
  icon: PortalIconName;
  value: string;
  onValueChange: (value: string) => void;
  items: { label: string; value: string }[];
  enabled?: boolean;
  error?: string;
  containerStyle?: ViewStyle;
};

function PortalPickerFieldComponent({
  label,
  icon,
  value,
  onValueChange,
  items,
  enabled = true,
  error,
  containerStyle,
}: PortalPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  const colors = useThemeColors();
  const tokens = portalInputTokens(colors, theme, open, !!error);

  const selectedItem = useMemo(
    () => items.find((item) => item.value === value),
    [items, value]
  );

  const displayLabel =
    selectedItem?.label ??
    items.find((item) => item.value === "")?.label ??
    "Seleccionar";
  const isPlaceholder = !value;

  const closeMenu = useCallback(() => setOpen(false), []);
  const handleSelect = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      setOpen(false);
    },
    [onValueChange]
  );

  return (
    <View style={[baseStyles.field, containerStyle]}>
      {label ? <Text style={[baseStyles.label, { color: colors.primaryText }]}>{label}</Text> : null}
      <Pressable
        disabled={!enabled}
        onPress={() => setOpen(true)}
        style={[
          baseStyles.control,
          !enabled ? { opacity: 0.55 } : null,
          {
            borderColor: tokens.borderColor,
            backgroundColor: tokens.backgroundColor,
          },
          open && !error
            ? {
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 3,
              }
            : null,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Ionicons
          name={icon}
          size={ICON_SIZE}
          color={tokens.iconColor}
          style={[baseStyles.icon, { opacity: tokens.iconOpacity }]}
          pointerEvents="none"
        />
        <Text
          style={[
            baseStyles.selectValue,
            {
              color: isPlaceholder ? tokens.placeholder : colors.primaryText,
            },
          ]}
          numberOfLines={1}
        >
          {displayLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={ICON_SIZE}
          color={tokens.iconColor}
          style={[baseStyles.chevron, { opacity: open ? 1 : tokens.iconOpacity }]}
          pointerEvents="none"
        />
      </Pressable>
      {error ? <Text style={baseStyles.errorText}>{error}</Text> : null}

      <PortalSelectMenu
        open={open}
        title={label}
        value={value}
        items={items}
        colors={colors}
        onClose={closeMenu}
        onSelect={handleSelect}
      />
    </View>
  );
}

export const PortalPickerField = memo(PortalPickerFieldComponent, (prev, next) => {
  return (
    prev.value === next.value &&
    prev.enabled === next.enabled &&
    prev.error === next.error &&
    prev.label === next.label &&
    prev.icon === next.icon &&
    prev.items === next.items &&
    prev.onValueChange === next.onValueChange
  );
});
