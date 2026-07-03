import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { ENV, APP_BRAND_NAME } from "../../utils/global";
import type { Suscription } from "../../types";
import { errorToast } from "../shared/toast/toasts";
import {
  PAY_WINDOW_DAYS,
  buildEpaycoCheckoutPayload,
  buildEpaycoCheckoutUrl,
  canPaySubscription,
  isPaymentAllowedByWindow,
} from "./pagoCheckout.shared";

export { PAY_WINDOW_DAYS };

interface PagoButtonProps {
  current_subscription: Suscription | null;
  company_name: string;
}

export default function PagoButtonNative({ current_subscription, company_name }: PagoButtonProps) {
  const [loading, setLoading] = useState(false);

  const epaycoReady = Boolean(ENV.EPAYCO_PUBLIC_KEY?.trim());
  const canPay = canPaySubscription(current_subscription, epaycoReady, loading);

  const handlePay = async () => {
    if (!current_subscription) return;

    if (!epaycoReady) {
      errorToast("Falta configurar la clave pública de ePayco.");
      return;
    }

    if (!isPaymentAllowedByWindow(current_subscription.end_date)) {
      errorToast(`El pago se habilita ${PAY_WINDOW_DAYS} días antes del vencimiento.`);
      return;
    }

    const feUrl = ENV.FE_URL?.trim();
    if (!feUrl) {
      errorToast("Falta configurar la URL del portal web para abrir el pago.");
      return;
    }

    setLoading(true);
    try {
      const checkoutUrl = buildEpaycoCheckoutUrl(
        feUrl,
        ENV.EPAYCO_PUBLIC_KEY,
        buildEpaycoCheckoutPayload(current_subscription, company_name, APP_BRAND_NAME)
      );
      await WebBrowser.openBrowserAsync(checkoutUrl);
    } catch {
      errorToast("No se pudo abrir la pasarela de pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      style={[styles.btn, !canPay && styles.btnDisabled]}
      onPress={() => void handlePay()}
      disabled={!canPay}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Ionicons name="card-outline" size={18} color="#fff" />
      )}
      <Text style={styles.btnText}>
        {loading ? "Procesando..." : "Pagar / Renovar suscripción"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6099ac",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
