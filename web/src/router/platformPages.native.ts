import type { ComponentType } from "react";

/**
 * Nativo: imports estáticos (sin React.lazy) — evita "Invalid base URL"
 * al cargar chunks dinámicos con async-require de Metro/Expo.
 */
import HomePage from "../features/home/page/Home.native";
import DashboardPage from "../features/dashboard/page/Dashboard.native";
import FacturarPage from "../features/dashboard/page/Facturar.native";
import ProfilePage from "../features/profile/page/Profile.native";
import DocumentsPage from "../features/documents/page/Documents.native";
import InvoiceCreatePage from "../features/documents/page/InvoiceCreate.native";
import DocumentDetailPage from "../features/documents/page/DocumentDetail.native";
import ClientsPage from "../features/clients/page/Clients.native";
import SubUsersPage from "../features/sub-users/page/SubUsers.native";
import ProductsServicesPage from "../features/products-services/page/ProductsServices.native";
import TercerosPage from "../features/terceros/page/Terceros.native";
import BillingHistoryPage from "../features/billing-history/page/BillingHistory.native";
import AnalyticsPage from "../features/analytics/page/AnalyticsPage.native";
import NominaEmpleadosPage from "../features/nomina/page/NominaEmpleados.native";
import DianSyncPage from "../features/dian-sync/page/DianSync.native";
import ConfigurationPage from "../features/accounting/page/Configuration.native";
import QuotesPage from "../features/quotes/page/Quotes.native";
import QuoteEditorPage from "../features/quotes/page/QuoteEditor.native";
import RecaudosPage from "../features/recaudos/page/Recaudos.native";
import FacturasPlantillaPage from "../features/plantillas/page/FacturasPlantilla.native";
import RemisionesPage from "../features/remisiones/page/Remisiones.native";
import PublicQuotePage from "../features/quotes/public/PublicQuote.native";
import PublicRemisionPage from "../features/remisiones/public/PublicRemision.native";
import SuppliersPage from "../features/purchases/page/Suppliers.native";
import PurchasesPage from "../features/purchases/page/Purchases.native";
import SupplierItemsPage from "../features/purchases/page/SupplierItems.native";
import TreasuryPaymentsPage from "../features/treasury/page/TreasuryPayments.native";
import TreasuryBatchesPage from "../features/treasury/page/TreasuryBatches.native";
import TreasuryBanksPage from "../features/treasury/page/TreasuryBanks.native";
import BankReconciliationPage from "../features/treasury/page/BankReconciliation.native";
import ConciliacionBancariaPage from "../features/treasury/page/ConciliacionBancaria.native";
import BankConciliationAssistPage from "../features/treasury/page/BankConciliationAssist.native";
import TreasuryCarteraPage from "../features/treasury/page/Cartera.native";
import TreasuryCxpPage from "../features/treasury/page/SaldosProveedor.native";
import TreasuryBolsaPage from "../features/treasury/page/BolsaPagos.native";
import TreasuryImportExtractoPage from "../features/treasury/page/ImportExtracto.native";
import AccountingPage from "../features/ledger/page/Accounting.native";
import FixedAssetsPage from "../features/assets/page/FixedAssets.native";
import InventoryPage from "../features/inventory/page/Inventory.native";
import AdminCompaniesPage from "../features/admin/page/AdminCompanies.native";
import AdminCompanyDetailPage from "../features/admin/page/AdminCompanyDetail.native";
import AdminAdminsPage from "../features/admin/page/AdminAdmins.native";
import AdminPlansPage from "../features/admin/page/AdminPlans.native";
import AdminContadoresPage from "../features/admin/page/AdminContadores.native";
import ReconcilePage from "../features/dian-reconcile/page/Reconcile.native";
import ReconcileSalesPage from "../features/dian-reconcile/page/ReconcileSales.native";
import ContadorLoginPage from "../features/contador/page/ContadorLogin.native";

type PageComponent = ComponentType<Record<string, unknown>>;

export {
  HomePage,
  DashboardPage,
  FacturarPage,
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
  ConciliacionBancariaPage,
  BankConciliationAssistPage,
  TreasuryCarteraPage,
  TreasuryCxpPage,
  TreasuryBolsaPage,
  TreasuryImportExtractoPage,
  AccountingPage,
  FixedAssetsPage,
  InventoryPage,
  AdminCompaniesPage,
  AdminCompanyDetailPage,
  AdminAdminsPage,
  AdminPlansPage,
  AdminContadoresPage,
  ReconcilePage,
  ReconcileSalesPage,
  ContadorLoginPage,
};

export type { PageComponent };
