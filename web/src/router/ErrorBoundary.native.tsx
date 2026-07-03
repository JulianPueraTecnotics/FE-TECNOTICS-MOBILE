import { Component, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : "Error inesperado" };
  }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary] página falló:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Algo salió mal en esta pantalla</Text>
          <Text style={styles.message}>{this.state.message}</Text>
          <Pressable style={styles.btn} onPress={() => this.setState({ hasError: false, message: undefined })}>
            <Text style={styles.btnText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 40, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: "#1a202c", marginBottom: 8, textAlign: "center" },
  message: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 16 },
  btn: { backgroundColor: "#5a9fb4", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "600" },
});

export default ErrorBoundary;
