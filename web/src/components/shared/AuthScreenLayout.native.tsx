import { View, type ReactNode } from "react-native";

/** Contenedor flex:1 para pantallas auth bajo el header fijo. */
export default function AuthScreenLayout({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
