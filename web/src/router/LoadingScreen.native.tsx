import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const LoadingScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#07c2c6" />
      <Text style={styles.label}>Cargando...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(240, 224, 224, 0.59)",
  },
  label: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: "600",
    color: "#002737",
  },
});

export default LoadingScreen;
