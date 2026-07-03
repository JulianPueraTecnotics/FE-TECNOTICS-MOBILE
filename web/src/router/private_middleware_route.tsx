import { Navigate } from "react-router-dom";
import { PATHS } from "./paths.contants";
import { useContext } from "react";
import { AuthContext } from "../store/auth.context";

/**
 * Rutas privadas: cualquier sesión válida (empresa, admin o subusuario).
 * `companyOnly`: solo cuenta titular (`company` / `admin`), p. ej. gestión de subusuarios.
 * `adminOnly`: solo superadmin (panel /admin).
 *
 * Además, separa los dos mundos: un superadmin no entra a páginas de empresa
 * (se le redirige al panel) y viceversa.
 */
const PrivateMiddlewareRoute = ({
    children,
    companyOnly = false,
    adminOnly = false,
}: {
    children: React.ReactNode;
    companyOnly?: boolean;
    adminOnly?: boolean;
}) => {
    const { user } = useContext(AuthContext);
    if (!user) {
        return <Navigate to={PATHS.LOGIN} />;
    }
    if (adminOnly && user.role !== "super_admin") {
        return <Navigate to={PATHS.DASHBOARD} replace />;
    }
    if (!adminOnly && user.role === "super_admin") {
        return <Navigate to={PATHS.ADMIN_HOME} replace />;
    }
    if (companyOnly && user.role === "user") {
        return <Navigate to={PATHS.DASHBOARD} replace />;
    }
    return children;
};

export default PrivateMiddlewareRoute;
