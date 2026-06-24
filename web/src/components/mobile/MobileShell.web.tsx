import { Platform } from "react-native";
import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../store/auth.context";
import { PATHS } from "../../router/paths.contants";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import MobileHeader from "./MobileHeader";
import MobileDrawer from "./MobileDrawer";
import MobileBottomNav from "./MobileBottomNav";
import "./mobile-shell.css";

const AUTH_PATHS = [PATHS.LOGIN, PATHS.REGISTER, PATHS.FORGOT_PASSWORD];
const PUBLIC_NO_SHELL = [PATHS.QUOTE_PUBLIC, PATHS.REMISION_PUBLIC];

function isPublicNoShellPath(pathname: string): boolean {
    if (pathname.startsWith("/cot/public/")) return true;
    if (pathname.startsWith("/remision/firmar/")) return true;
    if (pathname.startsWith("/continue/mandato/")) return true;
    return PUBLIC_NO_SHELL.some((p) => pathname === p);
}

const MobileShell: React.FC = () => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const pathname = location.pathname;
    const isAuthPage = AUTH_PATHS.includes(pathname);
    const isPublicHome = pathname === PATHS.HOME;
    const isPublicNoShell = isPublicNoShellPath(pathname);
    const isSuperAdmin = user?.role === "super_admin";
    const homePath = isSuperAdmin ? PATHS.ADMIN_HOME : PATHS.DASHBOARD;

    const showPrivateShell = Boolean(user && !isPublicHome && !isAuthPage && !isPublicNoShell);
    const showBottomNav = showPrivateShell;
    const showMenuButton = !isPublicNoShell;

    useBodyScrollLock(drawerOpen);

    useEffect(() => {
        setDrawerOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (Platform.OS !== "web" || typeof document === "undefined") return;
        const root = document.documentElement;
        root.classList.add("mobile-app");
        if (showBottomNav) root.classList.add("has-bottom-nav");
        else root.classList.remove("has-bottom-nav");
        root.classList.remove("has-app-sidebar");
        return () => {
            root.classList.remove("mobile-app", "has-bottom-nav", "has-app-sidebar");
        };
    }, [showBottomNav]);

    useEffect(() => {
        if (user && isAuthPage) {
            navigate(homePath, { replace: true });
        }
    }, [user, isAuthPage, navigate, homePath]);

    if (isPublicNoShell) {
        return null;
    }

    return (
        <>
            <MobileHeader
                onOpenMenu={() => setDrawerOpen(true)}
                showMenuButton={showMenuButton}
            />
            <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
            {showBottomNav && <MobileBottomNav onOpenMenu={() => setDrawerOpen(true)} />}
        </>
    );
};

export default MobileShell;
