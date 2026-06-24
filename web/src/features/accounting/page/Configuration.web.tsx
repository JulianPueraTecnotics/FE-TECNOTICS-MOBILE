import { useState, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import "./Configuration.css";
import DefaultAccounts from "../components/DefaultAccounts";
import Sequences from "../components/Sequences";
import CostCenters from "../components/CostCenters";
import Puc from "../components/Puc";
import Roles from "../components/Roles";
import Taxes from "../components/Taxes";
import {
  CONFIGURATION_NAV,
  CONFIGURATION_PROFILE_TAB,
  isConfigurationSection,
  type ConfigurationSection,
} from "./configuration.nav";

const ProfilePage = lazy(() => import("../../profile/page/Profile"));
const SubUsersPage = lazy(() => import("../../sub-users/page/SubUsers"));

const ConfigurationPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("sec");
  const [section, setSection] = useState<ConfigurationSection>(
    isConfigurationSection(initial) ? initial : "facturacion"
  );

  const go = (s: ConfigurationSection) => {
    setSection(s);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("sec", s);
      if (CONFIGURATION_PROFILE_TAB[s]) p.set("tab", CONFIGURATION_PROFILE_TAB[s]!);
      else p.delete("tab");
      return p;
    });
  };

  const groups = [...new Set(CONFIGURATION_NAV.map((n) => n.group))];

  const renderContent = () => {
    switch (section) {
      case "facturacion":
      case "documentos":
      case "eventos":
        return (
          <Suspense fallback={<div className="page-loading" style={{ padding: 24 }}>Cargando...</div>}>
            <ProfilePage mode="configuration" embedded />
          </Suspense>
        );
      case "usuarios":
        return (
          <Suspense fallback={<div className="page-loading" style={{ padding: 24 }}>Cargando...</div>}>
            <SubUsersPage />
          </Suspense>
        );
      case "cuentas":
        return <DefaultAccounts />;
      case "consecutivos":
        return <Sequences />;
      case "centros":
        return <CostCenters />;
      case "puc":
        return <Puc />;
      case "impuestos":
        return <Taxes />;
      case "roles":
        return <Roles />;
      default:
        return null;
    }
  };

  return (
    <main className="config-page">
      <div className="config-shell">
        <aside className="config-sidebar">
          <h1 className="config-title">
            <i className="ri-settings-3-line" /> Configuración
          </h1>
          {groups.map((g) => (
            <div key={g} className="config-nav-group">
              <span className="config-nav-group__label">{g}</span>
              {CONFIGURATION_NAV.filter((n) => n.group === g).map((n) => (
                <button
                  key={n.key}
                  className={`config-nav-item ${section === n.key ? "active" : ""}`}
                  onClick={() => go(n.key)}
                >
                  <i className={n.icon} /> {n.label}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <section className="config-content">{renderContent()}</section>
      </div>
    </main>
  );
};

export default ConfigurationPage;
