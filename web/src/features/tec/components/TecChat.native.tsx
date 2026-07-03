import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import TecAvatar from "../../../assets/Tec_asistente.png";
import {
  isTecUnavailable,
  sendTecByEmail,
  sendTecMessage,
  type TecMessage,
} from "../tec.service";
import TecMessageNative from "./TecMessage.native";

const SUGGESTIONS = [
  "¿Cómo emito una factura electrónica?",
  "¿Cómo causo una compra desde el XML de la DIAN?",
  "¿Cómo traigo mis facturas recibidas de la DIAN?",
  "¿Cómo inicializo la contabilidad y el PUC?",
];

type Props = { onClose: () => void };

export default function TecChatNative({ onClose }: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<TecMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingEmailIdx, setSendingEmailIdx] = useState<number | null>(null);
  const listRef = useRef<FlatList<TecMessage>>(null);

  useEffect(() => {
    if (messages.length === 0) return;
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed, timestamp: new Date().toISOString() }]);
    setInput("");
    setLoading(true);
    try {
      const data = await sendTecMessage(trimmed, conversationId);
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, timestamp: new Date().toISOString() },
      ]);
    } catch (error) {
      setMessages((prev) => prev.slice(0, -1));
      if (isTecUnavailable(error)) errorToast("El asistente TEC no está disponible en este momento.");
      else errorToast(error instanceof Error ? error.message : "No pude responderte ahora. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const sendByEmail = async (idx: number) => {
    if (!conversationId || sendingEmailIdx !== null) return;
    setSendingEmailIdx(idx);
    try {
      const { email } = await sendTecByEmail(conversationId, idx);
      successToast(`Enviado a ${email}`);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No pude enviar el correo. Intenta de nuevo.");
    } finally {
      setSendingEmailIdx(null);
    }
  };

  const newChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput("");
  };

  const empty = (
    <View style={styles.empty}>
      <Image source={TecAvatar} style={styles.hero} />
      <Text style={[styles.emptyTitle, { color: colors.primary }]}>¡Hola, soy TEC!</Text>
      <Text style={[styles.emptySub, { color: colors.textMuted }]}>Tu asistente del portal TECNOTICS</Text>
      <Text style={[styles.emptyLead, { color: colors.textMuted }]}>
        ¿En qué te puedo ayudar hoy? Resuelvo tus dudas sobre el uso de la plataforma.
      </Text>
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => void send(s)}
            style={[styles.suggestion, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}
          >
            <Text style={{ color: colors.primaryText, fontSize: 13 }}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.pageBg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <Image source={TecAvatar} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerName, { color: colors.primary }]}>TEC</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Asistente de TECNOTICS</Text>
        </View>
        <Pressable onPress={newChat} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="refresh-outline" size={22} color={colors.primaryText} />
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color={colors.primaryText} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={[styles.list, messages.length === 0 ? styles.listEmpty : null]}
        ListEmptyComponent={!loading ? empty : null}
        renderItem={({ item, index }) => (
          <TecMessageNative
            message={item}
            canSendByEmail={!!conversationId && item.role === "assistant"}
            isSendingByEmail={sendingEmailIdx === index}
            onSendByEmail={() => void sendByEmail(index)}
          />
        )}
        ListFooterComponent={
          loading ? (
            <View style={styles.typing}>
              <ActivityIndicator color={colors.headerAccent} />
              <Text style={{ color: colors.textMuted, marginLeft: 8 }}>TEC está escribiendo…</Text>
            </View>
          ) : null
        }
      />

      <View style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Escribe tu pregunta..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          editable={!loading}
          style={[
            styles.input,
            { color: colors.primaryText, borderColor: colors.border, backgroundColor: colors.cardBg },
          ]}
        />
        <Pressable
          onPress={() => void send(input)}
          disabled={loading || !input.trim()}
          style={[styles.sendBtn, { backgroundColor: colors.headerAccent, opacity: loading || !input.trim() ? 0.5 : 1 }]}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>TEC puede equivocarse. Verifica datos críticos.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  headerName: { fontSize: 17, fontWeight: "700" },
  iconBtn: { padding: 6 },
  list: { padding: 16, paddingBottom: 8 },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 24 },
  hero: { width: 80, height: 80, borderRadius: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "700" },
  emptySub: { fontSize: 14, marginTop: 4 },
  emptyLead: { fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20, paddingHorizontal: 8 },
  suggestions: { width: "100%", marginTop: 16, gap: 8 },
  suggestion: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, padding: 12 },
  typing: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: SHELL_RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: { fontSize: 11, textAlign: "center", paddingBottom: 8, paddingHorizontal: 16 },
});
