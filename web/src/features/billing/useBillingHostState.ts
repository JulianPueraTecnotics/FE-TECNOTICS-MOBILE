import { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCompanyWidgetSession } from "../dashboard/service";
import { getProfileService } from "../profile/page/services/get_profile";
import { AuthContext } from "../../store/auth.context";
import { ENV } from "../../utils/global";
import { parseBillingNavigateState, type BillingNavigateState } from "./billing.types";
import type { BillingScreenProps } from "./billing.types";

type BillingNotaState = BillingNavigateState["is_nota"];

export function useBillingHostState() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [authSession, setAuthSession] = useState({ company_id: "", simba_token: "" });
  const [loading, setLoading] = useState(true);
  // null = aún no sabemos; false = sin prefijos configurados; true = ya tiene.
  const [hasPrefixes, setHasPrefixes] = useState<boolean | null>(null);

  const [isNota, setIsNota] = useState<BillingNotaState | undefined>(() => {
    return parseBillingNavigateState(location.state).isNota;
  });

  const [recreateFacturaId] = useState<string | undefined>(() => {
    return parseBillingNavigateState(location.state).recreateFacturaId;
  });

  useEffect(() => {
    const s = location.state as BillingNavigateState | null | undefined;
    if (s?.is_nota) setIsNota(s.is_nota);
  }, [location.state]);

  useEffect(() => {
    const s = location.state as BillingNavigateState | null | undefined;
    if (s?.is_nota || s?.recreate_factura_id) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const [response, profile] = await Promise.all([
          getCompanyWidgetSession(),
          getProfileService().catch(() => null),
        ]);
        if (!ignore) {
          setAuthSession(response);
          const prefixes = profile?.company?.prefixes ?? [];
          setHasPrefixes(prefixes.length > 0);
        }
      } catch {
        if (!ignore) setAuthSession({ company_id: "", simba_token: "" });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const billingProps: BillingScreenProps | null =
    authSession.company_id && authSession.simba_token
      ? {
          companyId: authSession.company_id,
          simbaToken: authSession.simba_token,
          // El SDK usa feUrl como base del API/backend (no el SPA), igual que
          // el portal, donde FE_URL y BACK_URL apuntan al mismo backend.
          feUrl: ENV.API_URL,
          userId: user?.id,
          theme: "clean",
          isNotaOption: isNota?.option,
          isNotaRef: isNota?.ref,
          recreateFromFacturaId: recreateFacturaId,
          onNotaSubmitted: () => setIsNota(undefined),
        }
      : null;

  return {
    loading,
    billingProps,
    hasSession: Boolean(authSession.company_id && authSession.simba_token),
    hasPrefixes,
  };
}
