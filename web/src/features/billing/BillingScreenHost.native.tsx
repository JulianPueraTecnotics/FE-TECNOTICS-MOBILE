import { View, StyleSheet, Text } from "react-native";
import BillingScreenNative from "./BillingScreen.native";
import LoadingScreen from "../../router/LoadingScreen";
import PrefixSetupGateNative from "../../components/native/PrefixSetupGate.native";
import { useBillingHostState } from "./useBillingHostState";

/** Host nativo del facturador SDK (sesión widget + gates de carga). */
export default function BillingScreenHostNative() {
  const { loading, billingProps, hasSession, hasPrefixes } = useBillingHostState();

  if (loading) return <LoadingScreen />;

  if (!hasSession || !billingProps) {
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.messageText}>Aún no puedes expedir facturas, estamos trabajando en ello.</Text>
      </View>
    );
  }

  // Sin prefijos: usamos nuestro gate propio (navega dentro de la app), en vez del
  // gate del SDK que abre el portal web con Linking.openURL.
  if (hasPrefixes === false) {
    return <PrefixSetupGateNative />;
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
