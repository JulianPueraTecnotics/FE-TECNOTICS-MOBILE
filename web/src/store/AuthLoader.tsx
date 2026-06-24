import { useContext } from "react";
import { AuthContext } from "./auth.context";
import LoadingScreen from "../router/LoadingScreen";

export const AuthLoader = ({ children }: { children: React.ReactNode }) => {
    const { isLoading } = useContext(AuthContext);

    if (isLoading) {
        return <LoadingScreen />;
    }

    return <>{children}</>;
};