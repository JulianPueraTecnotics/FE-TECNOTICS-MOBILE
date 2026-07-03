import { useContext } from "react";
import { StyleSheet, View } from "react-native";
import { AuthContext } from "./auth.context";
import LoadingScreen from "../router/LoadingScreen";

export const AuthLoader = ({ children }: { children: React.ReactNode }) => {
  const { isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <LoadingScreen />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
