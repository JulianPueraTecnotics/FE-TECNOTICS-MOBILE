import { Platform } from "react-native";
import { BrowserRouter, MemoryRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { Suspense, useMemo, useEffect } from "react";
import LoginPage from "../features/login/page/Login";
import RegisterPage from "../features/register/page/Register";
import ForgotPasswordPage from "../features/forgot-password/page/ForgotPassword";
import { PATHS } from "./paths.contants";
import LoadingScreen from "./LoadingScreen";
import PrivateMiddlewareRoute from "./private_middleware_route";
import { ToastComponent } from "../components/shared/toast/toasts";
import MobileShell from "../components/mobile/MobileShell";
import TecAssistant from "../features/tec/components/TecAssistant";
import {
  HomePage,
  DashboardPage,
  ProfilePage,
  DocumentsPage,
  InvoiceCreatePage,
  DocumentDetailPage,
  ClientsPage,
  SubUsersPage,
  ProductsServicesPage,
  TercerosPage,
  BillingHistoryPage,
  AnalyticsPage,
  NominaEmpleadosPage,
  DianSyncPage,
  ConfigurationPage,
  QuotesPage,
  QuoteEditorPage,
  RecaudosPage,
  FacturasPlantillaPage,
  RemisionesPage,
  PublicQuotePage,
  PublicRemisionPage,
  SuppliersPage,
  PurchasesPage,
  SupplierItemsPage,
  TreasuryPaymentsPage,
  TreasuryBatchesPage,
  TreasuryBanksPage,
  BankReconciliationPage,
  AccountingPage,
  FixedAssetsPage,
  AdminCompaniesPage,
  AdminCompanyDetailPage,
  AdminAdminsPage,
  AdminPlansPage,
} from "./platformPages";
import { lazy } from "react";

const ContinueMandatoPage = lazy(() => import("../features/register/page/ContinueMandato"));

/** BrowserRouter en web; MemoryRouter en Expo Go (iOS/Android). */
const AppRouterProvider = Platform.OS === "web" ? BrowserRouter : MemoryRouter;

const routeScrollPositions = new Map<string, number>();

const getRouteKey = (pathname: string, search: string, hash: string) =>
  `${pathname}${search}${hash}`;

const isWebScrollEnv =
  Platform.OS === "web" &&
  typeof document !== "undefined" &&
  typeof window !== "undefined" &&
  typeof window.scrollTo === "function";

const getScrollContainer = () =>
  isWebScrollEnv ? document.querySelector<HTMLElement>(".container-scroll") : null;

const getCurrentScrollTop = () => {
  if (!isWebScrollEnv) return 0;
  const container = getScrollContainer();
  return container ? container.scrollTop : window.scrollY;
};

const setScrollTop = (top: number) => {
  if (!isWebScrollEnv) return;
  const container = getScrollContainer();
  if (container) {
    container.scrollTo({ top, behavior: "auto" });
    return;
  }
  window.scrollTo({ top, behavior: "auto" });
};

const ScrollManager: React.FC = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const routeKey = getRouteKey(location.pathname, location.search, location.hash);

  useEffect(() => {
    if (!isWebScrollEnv) return;
    return () => {
      routeScrollPositions.set(routeKey, getCurrentScrollTop());
    };
  }, [routeKey]);

  useEffect(() => {
    if (!isWebScrollEnv) return;
    requestAnimationFrame(() => {
      if (navigationType === "POP") {
        const savedScroll = routeScrollPositions.get(routeKey) ?? 0;
        setScrollTop(savedScroll);
        return;
      }
      setScrollTop(0);
    });
  }, [routeKey, navigationType]);

  return null;
};

const PrivateRouteSwitch: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const element = useMemo(() => {
    const protectedWrap = (el: React.ReactNode) => <PrivateMiddlewareRoute>{el}</PrivateMiddlewareRoute>;
    const companyOnlyWrap = (el: React.ReactNode) => (
      <PrivateMiddlewareRoute companyOnly>{el}</PrivateMiddlewareRoute>
    );
    const adminWrap = (el: React.ReactNode) => (
      <PrivateMiddlewareRoute adminOnly>{el}</PrivateMiddlewareRoute>
    );

    switch (pathname) {
      case PATHS.DASHBOARD:
        return protectedWrap(<DashboardPage />);
      case PATHS.DOCUMENTS:
        return protectedWrap(<DocumentsPage />);
      case PATHS.DOCUMENT_CREATE:
        return protectedWrap(<InvoiceCreatePage />);
      case PATHS.CLIENTS:
        return protectedWrap(<ClientsPage />);
      case PATHS.SUB_USERS:
        return companyOnlyWrap(<SubUsersPage />);
      case PATHS.PRODUCTS_SERVICES:
        return protectedWrap(<ProductsServicesPage />);
      case PATHS.TERCEROS:
        return protectedWrap(<TercerosPage />);
      case PATHS.BILLING_HISTORY:
        return protectedWrap(<BillingHistoryPage />);
      case PATHS.ANALYTICS:
        return protectedWrap(<AnalyticsPage />);
      case PATHS.NOMINA_EMPLEADOS:
        return protectedWrap(<NominaEmpleadosPage />);
      case PATHS.DIAN_SYNC:
        return protectedWrap(<DianSyncPage />);
      case PATHS.MY_PROFILE:
        return protectedWrap(<ProfilePage mode="profile" />);
      case PATHS.CONFIGURATION:
        return companyOnlyWrap(<ConfigurationPage />);
      case PATHS.SALES_COTIZACIONES:
        return protectedWrap(<QuotesPage />);
      case PATHS.SALES_COTIZACIONES_NUEVA:
        return protectedWrap(<QuoteEditorPage />);
      case PATHS.SALES_RECAUDOS:
        return protectedWrap(<RecaudosPage />);
      case PATHS.SALES_PLANTILLAS:
        return protectedWrap(<FacturasPlantillaPage />);
      case PATHS.SALES_REMISIONES:
        return protectedWrap(<RemisionesPage />);
      case PATHS.PURCHASES_SUPPLIERS:
        return protectedWrap(<SuppliersPage />);
      case PATHS.PURCHASES_COMPRAS:
        return protectedWrap(<PurchasesPage kind="purchase" />);
      case PATHS.PURCHASES_GASTOS:
        return protectedWrap(<PurchasesPage kind="expense" />);
      case PATHS.PURCHASES_PARAM:
        return protectedWrap(<SupplierItemsPage />);
      case PATHS.PURCHASES:
        return protectedWrap(<PurchasesPage kind="purchase" />);
      case PATHS.TREASURY:
      case PATHS.TREASURY_PAGOS:
        return protectedWrap(<TreasuryPaymentsPage />);
      case PATHS.TREASURY_LOTES:
        return protectedWrap(<TreasuryBatchesPage />);
      case PATHS.TREASURY_BANCOS:
        return protectedWrap(<TreasuryBanksPage />);
      case PATHS.TREASURY_CONCILIACION:
        return protectedWrap(<BankReconciliationPage />);
      case PATHS.ACCOUNTING:
        return protectedWrap(<AccountingPage />);
      case PATHS.FIXED_ASSETS:
        return protectedWrap(<FixedAssetsPage />);
      case PATHS.ADMIN_HOME:
        return adminWrap(<AdminCompaniesPage />);
      case PATHS.ADMIN_ADMINS:
        return adminWrap(<AdminAdminsPage />);
      case PATHS.ADMIN_PLANS:
        return adminWrap(<AdminPlansPage />);
      default:
        return null;
    }
  }, [pathname]);

  return element;
};

const AppRouter = () => {
  return (
    <AppRouterProvider>
      <Suspense fallback={<LoadingScreen />}>
        <ScrollManager />
        <MobileShell />
        <ToastComponent />
        <Routes>
          <Route
            path={PATHS.ADMIN_COMPANY_DETAIL(":companyId")}
            element={
              <PrivateMiddlewareRoute adminOnly>
                <AdminCompanyDetailPage />
              </PrivateMiddlewareRoute>
            }
          />
          <Route path={PATHS.HOME} element={<HomePage />} />
          <Route path={PATHS.LOGIN} element={<LoginPage />} />
          <Route path={PATHS.REGISTER} element={<RegisterPage />} />
          <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
          <Route path={PATHS.CONTINUE_MANDATO} element={<ContinueMandatoPage />} />
          <Route path={PATHS.QUOTE_PUBLIC} element={<PublicQuotePage />} />
          <Route path={PATHS.REMISION_PUBLIC} element={<PublicRemisionPage />} />
          <Route
            path={PATHS.SALES_COTIZACIONES_EDITAR(":id")}
            element={
              <PrivateMiddlewareRoute>
                <QuoteEditorPage />
              </PrivateMiddlewareRoute>
            }
          />
          <Route
            path={PATHS.DOCUMENT_CREATE}
            element={
              <PrivateMiddlewareRoute>
                <InvoiceCreatePage />
              </PrivateMiddlewareRoute>
            }
          />
          <Route
            path={PATHS.DOCUMENT_DETAIL}
            element={
              <PrivateMiddlewareRoute>
                <DocumentDetailPage />
              </PrivateMiddlewareRoute>
            }
          />
          <Route path="*" element={<PrivateRouteSwitch />} />
        </Routes>
        <TecAssistant />
      </Suspense>
    </AppRouterProvider>
  );
};

export default AppRouter;
