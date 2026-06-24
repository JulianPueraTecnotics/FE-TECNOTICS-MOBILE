import { lazy } from "react";
import { lazyPlatformPage } from "./lazyPlatformPage";

/** Entrada con switch web/native interno. */
export const HomePage = lazy(() => import("../features/home/page/Home"));
export const DashboardPage = lazyPlatformPage(
  () => import("../features/dashboard/page/Dashboard.web"),
  () => import("../features/dashboard/page/Dashboard.native")
);
export const ProfilePage = lazyPlatformPage(
  () => import("../features/profile/page/Profile.web"),
  () => import("../features/profile/page/Profile.native")
);

/** Módulos del portal: web = componente DOM; nativo = pantalla nativa o módulo en app. */
export const DocumentsPage = lazyPlatformPage(
  () => import("../features/documents/page/Documents"),
  () => import("../features/documents/page/Documents.native")
);
export const InvoiceCreatePage = lazyPlatformPage(
  () => import("../features/documents/page/InvoiceCreate"),
  () => import("../features/documents/page/InvoiceCreate.native")
);
export const DocumentDetailPage = lazyPlatformPage(() => import("../features/documents/page/DocumentDetail"));
export const ClientsPage = lazyPlatformPage(
  () => import("../features/clients/page/Clients"),
  () => import("../features/clients/page/Clients.native")
);
export const SubUsersPage = lazyPlatformPage(() => import("../features/sub-users/page/SubUsers"));
export const ProductsServicesPage = lazyPlatformPage(
  () => import("../features/products-services/page/ProductsServices"),
  () => import("../features/products-services/page/ProductsServices.native")
);
export const TercerosPage = lazyPlatformPage(
  () => import("../features/terceros/page/Terceros"),
  () => import("../features/terceros/page/Terceros.native")
);
export const BillingHistoryPage = lazyPlatformPage(() =>
  import("../features/billing-history/page/BillingHistory")
);
export const AnalyticsPage = lazyPlatformPage(
  () => import("../features/analytics/page/AnalyticsPage"),
  () => import("../features/analytics/page/AnalyticsPage.native")
);
export const NominaEmpleadosPage = lazyPlatformPage(
  () => import("../features/nomina/page/NominaEmpleados"),
  () => import("../features/nomina/page/NominaEmpleados.native")
);
export const DianSyncPage = lazyPlatformPage(
  () => import("../features/dian-sync/page/DianSync"),
  () => import("../features/dian-sync/page/DianSync.native")
);
export const ConfigurationPage = lazyPlatformPage(
  () => import("../features/accounting/page/Configuration.web"),
  () => import("../features/accounting/page/Configuration.native")
);
export const QuotesPage = lazyPlatformPage(
  () => import("../features/quotes/page/Quotes"),
  () => import("../features/quotes/page/Quotes.native")
);
export const QuoteEditorPage = lazyPlatformPage(
  () => import("../features/quotes/page/QuoteEditor"),
  () => import("../features/quotes/page/QuoteEditor.native")
);
export const RecaudosPage = lazyPlatformPage(
  () => import("../features/recaudos/page/Recaudos"),
  () => import("../features/recaudos/page/Recaudos.native")
);
export const FacturasPlantillaPage = lazyPlatformPage(
  () => import("../features/plantillas/page/FacturasPlantilla"),
  () => import("../features/plantillas/page/FacturasPlantilla.native")
);
export const RemisionesPage = lazyPlatformPage(
  () => import("../features/remisiones/page/Remisiones"),
  () => import("../features/remisiones/page/Remisiones.native")
);
export const PublicQuotePage = lazyPlatformPage(() => import("../features/quotes/public/PublicQuote"));
export const PublicRemisionPage = lazyPlatformPage(() =>
  import("../features/remisiones/public/PublicRemision")
);
export const SuppliersPage = lazyPlatformPage(
  () => import("../features/purchases/page/Suppliers"),
  () => import("../features/purchases/page/Suppliers.native")
);
export const PurchasesPage = lazyPlatformPage(
  () => import("../features/purchases/page/Purchases"),
  () => import("../features/purchases/page/Purchases.native")
);
export const SupplierItemsPage = lazyPlatformPage(
  () => import("../features/purchases/page/SupplierItems"),
  () => import("../features/purchases/page/SupplierItems.native")
);
export const TreasuryPaymentsPage = lazyPlatformPage(
  () => import("../features/treasury/page/TreasuryPayments"),
  () => import("../features/treasury/page/TreasuryPayments.native")
);
export const TreasuryBatchesPage = lazyPlatformPage(
  () => import("../features/treasury/page/TreasuryBatches"),
  () => import("../features/treasury/page/TreasuryBatches.native")
);
export const TreasuryBanksPage = lazyPlatformPage(
  () => import("../features/treasury/page/TreasuryBanks"),
  () => import("../features/treasury/page/TreasuryBanks.native")
);
export const BankReconciliationPage = lazyPlatformPage(
  () => import("../features/treasury/page/BankReconciliation"),
  () => import("../features/treasury/page/BankReconciliation.native")
);
export const AccountingPage = lazyPlatformPage(
  () => import("../features/ledger/page/Accounting"),
  () => import("../features/ledger/page/Accounting.native")
);
export const FixedAssetsPage = lazyPlatformPage(
  () => import("../features/assets/page/FixedAssets"),
  () => import("../features/assets/page/FixedAssets.native")
);
export const AdminCompaniesPage = lazyPlatformPage(() => import("../features/admin/page/AdminCompanies"));
export const AdminCompanyDetailPage = lazyPlatformPage(() =>
  import("../features/admin/page/AdminCompanyDetail")
);
export const AdminAdminsPage = lazyPlatformPage(() => import("../features/admin/page/AdminAdmins"));
export const AdminPlansPage = lazyPlatformPage(() => import("../features/admin/page/AdminPlans"));
