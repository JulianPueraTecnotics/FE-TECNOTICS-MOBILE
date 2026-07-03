import { lazy } from "react";
import { lazyPlatformPage } from "./lazyPlatformPage";

/** Entrada con switch web/native interno. */
export const HomePage = lazy(() => import("../features/home/page/Home"));
export const DashboardPage = lazyPlatformPage(
  () => import("../features/dashboard/page/Dashboard.web"),
  () => import("../features/dashboard/page/Dashboard.native")
);
export const FacturarPage = lazyPlatformPage(
  () => import("../features/dashboard/page/Facturar.web"),
  () => import("../features/dashboard/page/Facturar.native")
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
export const DocumentDetailPage = lazyPlatformPage(
  () => import("../features/documents/page/DocumentDetail"),
  () => import("../features/documents/page/DocumentDetail.native")
);
export const ClientsPage = lazyPlatformPage(
  () => import("../features/clients/page/Clients"),
  () => import("../features/clients/page/Clients.native")
);
export const SubUsersPage = lazyPlatformPage(
  () => import("../features/sub-users/page/SubUsers"),
  () => import("../features/sub-users/page/SubUsers.native")
);
export const ProductsServicesPage = lazyPlatformPage(
  () => import("../features/products-services/page/ProductsServices"),
  () => import("../features/products-services/page/ProductsServices.native")
);
export const TercerosPage = lazyPlatformPage(
  () => import("../features/terceros/page/Terceros"),
  () => import("../features/terceros/page/Terceros.native")
);
export const BillingHistoryPage = lazyPlatformPage(
  () => import("../features/billing-history/page/BillingHistory"),
  () => import("../features/billing-history/page/BillingHistory.native")
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
export const PublicQuotePage = lazyPlatformPage(
  () => import("../features/quotes/public/PublicQuote"),
  () => import("../features/quotes/public/PublicQuote.native")
);
export const PublicRemisionPage = lazyPlatformPage(
  () => import("../features/remisiones/public/PublicRemision"),
  () => import("../features/remisiones/public/PublicRemision.native")
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
export const ConciliacionBancariaPage = lazyPlatformPage(
  () => import("../features/treasury/page/ConciliacionBancaria"),
  () => import("../features/treasury/page/ConciliacionBancaria.native")
);
export const BankConciliationAssistPage = lazyPlatformPage(
  () => import("../features/treasury/page/BankConciliationAssist"),
  () => import("../features/treasury/page/BankConciliationAssist.native")
);
export const TreasuryCarteraPage = lazyPlatformPage(
  () => import("../features/treasury/page/Cartera"),
  () => import("../features/treasury/page/Cartera.native")
);
export const TreasuryCxpPage = lazyPlatformPage(
  () => import("../features/treasury/page/SaldosProveedor"),
  () => import("../features/treasury/page/SaldosProveedor.native")
);
export const TreasuryBolsaPage = lazyPlatformPage(
  () => import("../features/treasury/page/BolsaPagos"),
  () => import("../features/treasury/page/BolsaPagos.native")
);
export const TreasuryImportExtractoPage = lazyPlatformPage(
  () => import("../features/treasury/page/ImportExtracto"),
  () => import("../features/treasury/page/ImportExtracto.native")
);
export const AccountingPage = lazyPlatformPage(
  () => import("../features/ledger/page/Accounting"),
  () => import("../features/ledger/page/Accounting.native")
);
export const FixedAssetsPage = lazyPlatformPage(
  () => import("../features/assets/page/FixedAssets"),
  () => import("../features/assets/page/FixedAssets.native")
);
export const InventoryPage = lazyPlatformPage(
  () => import("../features/inventory/page/Inventory"),
  () => import("../features/inventory/page/Inventory.native")
);
export const AdminCompaniesPage = lazyPlatformPage(
  () => import("../features/admin/page/AdminCompanies"),
  () => import("../features/admin/page/AdminCompanies.native")
);
export const AdminCompanyDetailPage = lazyPlatformPage(
  () => import("../features/admin/page/AdminCompanyDetail"),
  () => import("../features/admin/page/AdminCompanyDetail.native")
);
export const AdminAdminsPage = lazyPlatformPage(
  () => import("../features/admin/page/AdminAdmins"),
  () => import("../features/admin/page/AdminAdmins.native")
);
export const AdminPlansPage = lazyPlatformPage(
  () => import("../features/admin/page/AdminPlans"),
  () => import("../features/admin/page/AdminPlans.native")
);
export const AdminContadoresPage = lazyPlatformPage(
  () => import("../features/admin/page/AdminContadores"),
  () => import("../features/admin/page/AdminContadores.native")
);
export const ReconcilePage = lazyPlatformPage(
  () => import("../features/dian-reconcile/page/Reconcile"),
  () => import("../features/dian-reconcile/page/Reconcile.native")
);
export const ReconcileSalesPage = lazyPlatformPage(
  () => import("../features/dian-reconcile/page/ReconcileSales"),
  () => import("../features/dian-reconcile/page/ReconcileSales.native")
);
export const ContadorLoginPage = lazyPlatformPage(
  () => import("../features/contador/page/ContadorLogin"),
  () => import("../features/contador/page/ContadorLogin.native")
);
