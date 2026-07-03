import "./Dashboard.css";
import { TecnoticsProvider, BillingComponent } from "@tecnotics/fe-billing";
import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCompanyWidgetSession } from "../service";
import { ENV } from "../../../utils/global";
import { PATHS } from "../../../router/paths.contants";
import LoadingScreen from "../../../router/LoadingScreen";
import { AuthContext } from "../../../store/auth.context";

type DashboardNavigateState = {
    is_nota?: {
        option: "credito" | "debito";
        ref: string;
    };
    /** Id de la factura a "Recrear": el componente cargará su cliente + ítems como plantilla. */
    recreate_factura_id?: string;
};

/** Ruta del SDK apunta a /mi-perfil; en este portal la config de prefijos vive en Configuración. */
const BILLING_PREFIX_CONFIG_PATH = `${PATHS.CONFIGURATION}?sec=facturacion&tab=billing-config`;

/**
 * Página de facturación (widget del SDK). Facturar y POS comparten la misma experiencia
 * (tema clean, sin is_fast) hasta que el POS tenga props de facturador rápido configurados.
 */
const DashboardPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [auth_session, setAuthSession] = useState<{
        company_id: string;
        simba_token: string;
    }>({
        company_id: "",
        simba_token: "",
    });
    const [loading, setLoading] = useState(true);
    const { user } = useContext(AuthContext);

    const [isNota, setIsNota] = useState<DashboardNavigateState["is_nota"]>(() => {
        const s = location.state as DashboardNavigateState | null | undefined;
        return s?.is_nota;
    });

    const [recreateFacturaId] = useState<string | undefined>(() => {
        const s = location.state as DashboardNavigateState | null | undefined;
        return s?.recreate_factura_id;
    });

    useEffect(() => {
        const s = location.state as DashboardNavigateState | null | undefined;
        if (s?.is_nota || s?.recreate_factura_id) {
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.state, location.pathname, navigate]);

    /** El SDK enlaza a /mi-perfil?tab=billing-config; redirigimos a Configuración › Conf. de facturas. */
    useEffect(() => {
        const onSetupLink = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const link = target.closest("a.tecnotics-account-setup-btn");
            if (!link) return;
            const href = link.getAttribute("href") ?? "";
            if (!href.includes("billing-config") && !href.includes("mi-perfil")) return;
            event.preventDefault();
            navigate(BILLING_PREFIX_CONFIG_PATH);
        };
        document.addEventListener("click", onSetupLink, true);
        return () => document.removeEventListener("click", onSetupLink, true);
    }, [navigate]);

    const getWidgetSession = async () => {
        setLoading(true);
        try {
            const response = await getCompanyWidgetSession();
            setAuthSession(response);
        } catch (error: unknown) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getWidgetSession();
    }, []);

    return (
        <div className="dashboard-page">
            {loading && <LoadingScreen />}

            {loading && auth_session.company_id && !auth_session.simba_token && (
                <div className="dashboard-page__message">Aun no puedes expedir facturas, estamos trabajando en ello.</div>
            )}

            {auth_session.company_id && auth_session.simba_token && (
                <TecnoticsProvider
                    company_id={`${auth_session.company_id}|${user?.id}`}
                    simba_token={auth_session.simba_token}
                    fe_url={ENV.FE_URL}
                >
                    <BillingComponent
                        theme="clean"
                        is_nota={isNota}
                        onNotaSubmitted={() => setIsNota(undefined)}
                        recreate_from_factura_id={recreateFacturaId}
                    />
                </TecnoticsProvider>
            )}
        </div>
    );
};

export default DashboardPage;
