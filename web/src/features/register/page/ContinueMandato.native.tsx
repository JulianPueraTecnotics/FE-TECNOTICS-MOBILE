import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useParams } from "react-router-dom";
import { ENV } from "../../../utils/global";

/** Firma PDF requiere canvas/DOM — solo disponible en web. */
const ContinueMandato: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const webUrl = companyId
    ? `${ENV.FE_URL}/continue/mandato/${companyId}`
    : ENV.FE_URL;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firma del contrato de mandato</Text>
      <Text style={styles.text}>
        La firma del PDF requiere el navegador. Abre el portal web para completar este paso.
      </Text>
      <Text style={styles.link} onPress={() => Linking.openURL(webUrl)}>
        Continuar en el portal web
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f5f7fa",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#002737",
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
    marginBottom: 20,
  },
  link: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0077b6",
  },
});

export default ContinueMandato;
