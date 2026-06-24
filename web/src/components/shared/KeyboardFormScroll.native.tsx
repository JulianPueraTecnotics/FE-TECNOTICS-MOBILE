import { type ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
} & Pick<ScrollViewProps, "keyboardShouldPersistTaps">;

/** Scroll único para formularios — sin listeners de teclado que re-renderizan en cada pulsación. */
export default function KeyboardFormScroll({
  children,
  style,
  contentContainerStyle,
  keyboardShouldPersistTaps = "always",
}: Props) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={false}
        contentContainerStyle={[{ flexGrow: 1, paddingBottom: 48 }, contentContainerStyle]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function useScrollFieldIntoView(): (node: View | null) => void {
  return () => undefined;
}
