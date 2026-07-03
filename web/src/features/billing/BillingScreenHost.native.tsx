import { View, StyleSheet, Text } from "react-native";
import BillingScreenNative from "./BillingScreen.native";
import LoadingScreen from "../../router/LoadingScreen";
import { useBillingHostState } from "./useBillingHostState";

/** Host nativo del facturador SDK (sesión widget + gates de carga). */
export default function BillingScreenHostNative() {
  const { loading, billingProps, hasSession } = useBillingHostState();

  if (loading) return <LoadingScreen />;

  if (!hasSession || !billingProps) {
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.messageText}>Aún no puedes expedir facturas, estamos trabajando en ello.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <BillingScreenNative {...billingProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  messageWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  messageText: { fontSize: 15, textAlign: "center", lineHeight: 22, color: "#64748b" },
});
