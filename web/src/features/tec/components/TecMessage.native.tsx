import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import type { TecMessage as TecMessageType } from "../tec.service";

const LONG_THRESHOLD = 350;

type Props = {
  message: TecMessageType;
  canSendByEmail?: boolean;
  isSendingByEmail?: boolean;
  onSendByEmail?: () => void;
};

/** Texto plano — en nativo no renderizamos Markdown completo. */
function plainContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export default function TecMessageNative({
  message,
  canSendByEmail,
  isSendingByEmail,
  onSendByEmail,
}: Props) {
  const colors = useThemeColors();
  const isUser = message.role === "user";
  const showEmail =
    !isUser && canSendByEmail && !!onSendByEmail && message.content.length >= LONG_THRESHOLD;

  return (
    <View
      style={[
        styles.wrap,
        isUser
          ? [styles.user, { backgroundColor: colors.headerAccent }]
          : [styles.assistant, { backgroundColor: colors.cardBg, borderColor: colors.border }],
      ]}
    >
      <Text style={[styles.text, { color: isUser ? "#fff" : colors.primaryText }]}>
        {plainContent(message.content)}
      </Text>
      {showEmail ? (
        <Pressable
          onPress={onSendByEmail}
          disabled={isSendingByEmail}
          style={[styles.emailBtn, { borderColor: colors.headerAccent }]}
        >
          {isSendingByEmail ? (
            <ActivityIndicator size="small" color={colors.headerAccent} />
          ) : (
            <Text style={{ color: colors.headerAccent, fontWeight: "600", fontSize: 13 }}>
              Enviar al correo
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: "88%", marginBottom: 10, borderRadius: SHELL_RADIUS.card, padding: 12 },
  user: { alignSelf: "flex-end" },
  assistant: { alignSelf: "flex-start", borderWidth: 1 },
  text: { fontSize: 14, lineHeight: 20 },
  emailBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
});
