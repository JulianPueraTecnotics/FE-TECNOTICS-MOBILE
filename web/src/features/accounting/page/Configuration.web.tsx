import { useState, lazy, Suspense, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "./Configuration.css";
import { ListPageShell, useIsMobile } from "../../../components/design-system";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import DefaultAccounts from "../components/DefaultAccounts";
import Sequences from "../components/Sequences";
import CostCenters from "../components/CostCenters";
import Puc from "../components/Puc";
import Roles from "../components/Roles";
import Taxes from "../components/Taxes";
import TaxProfile from "../components/TaxProfile";
import AuditLog from "../components/AuditLog";

const ProfilePage = lazy(() => import("../../profile/page/Profile.web"));
const SubUsersPage = lazy(() => import("../../sub-users/page/SubUsers"));

const CONFIG_NAV_BREAKPOINT = 920;

type Section = "facturacion" | "documentos" | "eventos" | "usuarios" | "cuentas" | "consecutivos" | "centros" | "puc" | "impuestos" | "perfil_tributario" | "roles" | "auditoria";

interface NavItem {
    key: Section;
    label: string;
    icon: string;
    group: string;
}

const NAV: NavItem[] = [
    { key: "facturacion", label: "Conf. de facturas", icon: "ri-file-settings-line", group: "Empresa" },
    { key: "documentos", label: "Documentos de cuenta", icon: "ri-folder-3-line", group: "Empresa" },
    { key: "eventos", label: "Consola de eventos", icon: "ri-terminal-box-line", group: "Empresa" },
    { key: "usuarios", label: "Usuarios", icon: "ri-team-line", group: "Seguridad" },
    { key: "roles", label: "Roles y permisos", icon: "ri-shield-keyhole-line", group: "Seguridad" },
    { key: "auditoria", label: "Pista de auditoría", icon: "ri-history-line", group: "Seguridad" },
    { key: "cuentas", label: "Cuentas por defecto", icon: "ri-bank-line", group: "Contabilidad" },
    { key: "consecutivos", label: "Consecutivos", icon: "ri-list-ordered", group: "Contabilidad" },
    { key: "centros", label: "Centros de costo", icon: "ri-price-tag-3-line", group: "Contabilidad" },
    { key: "puc", label: "Plan de cuentas (PUC)", icon: "ri-book-2-line", group: "Contabilidad" },
    { key: "impuestos", label: "Impuestos y retenciones", icon: "ri-percent-line", group: "Contabilidad" },
    { key: "perfil_tributario", label: "Perfil tributario (DIAN)", icon: "ri-government-line", group: "Contabilidad" },
];

const PROFILE_TAB: Partial<Record<Section, string>> = {
    facturacion: "billing-config",
    documentos: "documents",
    eventos: "events",
};

type ConfigNavProps = {
    section: Section;
    onSelect: (s: Section) => void;
    variant?: "sidebar" | "drawer";
};

const ConfigNav: React.FC<ConfigNavProps> = ({ section, onSelect, variant = "sidebar" }) => {
    const groups = [...new Set(NAV.map((n) => n.group))];
    const itemClass = variant === "drawer" ? "config-nav-item config-nav-item--drawer" : "config-nav-item";

    return (
        <nav className="config-nav" aria-label="Secciones de configuración">
            {groups.map((g) => (
                <div key={g} className="config-nav-group">
                    <span className="config-nav-group__label">{g}</span>
                    {NAV.filter((n) => n.group === g).map((n) => (
                        <button
                            key={n.key}
                            type="button"
                            className={`${itemClass} ${section === n.key ? "active" : ""}`}
                            onClick={() => onSelect(n.key)}
                        >
                            <span className="config-nav-item__icon" aria-hidden>
                                <i className={n.icon} />
                            </span>
                            <span className="config-nav-item__label">{n.label}</span>
                            {section === n.key ? <i className="ri-check-line config-nav-item__check" aria-hidden /> : null}
                        </button>
                    ))}
                </div>
            ))}
        </nav>
    );
};

const ConfigurationPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initial = (searchParams.get("sec") as Section) || "facturacion";
    const [section, setSection] = useState<Section>(NAV.some((n) => n.key === initial) ? initial : "facturacion");
    const isMobileNav = useIsMobile(CONFIG_NAV_BREAKPOINT);
    const [drawerOpen, setDrawerOpen] = useState(false);

    useBodyScrollLock(isMobileNav && drawerOpen);

    useEffect(() => {
        if (!isMobileNav) setDrawerOpen(false);
    }, [isMobileNav]);

    useEffect(() => {
        if (!isMobileNav || !drawerOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setDrawerOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isMobileNav, drawerOpen]);

    const activeNav = useMemo(() => NAV.find((n) => n.key === section) ?? NAV[0], [section]);

    const go = useCallback(
        (s: Section) => {
            setSection(s);
            setSearchParams((prev) => {
                const p = new URLSearchParams(prev);
                p.set("sec", s);
                if (PROFILE_TAB[s]) p.set("tab", PROFILE_TAB[s]!);
                else p.delete("tab");
                return p;
            });
            if (isMobileNav) setDrawerOpen(false);
        },
        [isMobileNav, setSearchParams],
    );

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
                        <SubUsersPage embedded />
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
            case "perfil_tributario":
                return <TaxProfile />;
            case "roles":
                return <Roles />;
            case "auditoria":
                return <AuditLog />;
            default:
                return null;
        }
    };

    const mobileDrawer =
        isMobileNav && drawerOpen
            ? createPortal(
                  <>
                      <button
                          type="button"
                          className="config-drawer-overlay"
                          aria-label="Cerrar menú de configuración"
                          onClick={() => setDrawerOpen(false)}
                      />
                      <aside
                          className="config-drawer"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="config-drawer-title"
                      >
                          <header className="config-drawer__head">
                              <div className="config-drawer__title-wrap">
                                  <h2 id="config-drawer-title" className="config-drawer__title">
                                      <i className="ri-settings-3-line" aria-hidden /> Configuración
                                  </h2>
                                  <p className="config-drawer__subtitle">Elige la sección que quieres editar</p>
                              </div>
                              <button
                                  type="button"
                                  className="config-drawer__close"
                                  aria-label="Cerrar menú"
                                  onClick={() => setDrawerOpen(false)}
                              >
                                  <i className="ri-close-line" aria-hidden />
                              </button>
                          </header>
                          <div className="config-drawer__body">
                              <ConfigNav section={section} onSelect={go} variant="drawer" />
                          </div>
                      </aside>
                  </>,
                  document.body,
              )
            : null;

    return (
        <ListPageShell className="config-page container-scroll">
            {mobileDrawer}

            <div className="config-shell">
                {!isMobileNav ? (
                    <aside className="config-sidebar config-sidebar--desktop">
                        <div className="config-sidebar__head">
                            <h1 className="config-title">
                                <i className="ri-settings-3-line" aria-hidden /> Configuración
                            </h1>
                        </div>
                        <ConfigNav section={section} onSelect={go} />
                    </aside>
                ) : null}

                <section className="config-content">
                    <header className="config-content-toolbar">
                        {isMobileNav ? (
                            <button
                                type="button"
                                className="config-nav-toggle"
                                onClick={() => setDrawerOpen(true)}
                                aria-expanded={drawerOpen}
                                aria-haspopup="dialog"
                            >
                                <span className="config-nav-toggle__icon" aria-hidden>
                                    <i className="ri-settings-3-line" />
                                </span>
                                Configuración
                            </button>
                        ) : null}
                        <div className="config-content-toolbar__title">
                            <i className={activeNav.icon} aria-hidden />
                            <span>{activeNav.label}</span>
                        </div>
                    </header>
                    <div className="config-content__body">{renderContent()}</div>
                </section>
            </div>
        </ListPageShell>
    );
};

export default ConfigurationPage;
