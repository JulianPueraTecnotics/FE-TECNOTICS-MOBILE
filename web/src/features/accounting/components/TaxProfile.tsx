import { useEffect, useState } from "react";
import { getTaxProfile, updateTaxProfile } from "../../dashboard/tax.service";
import type { TaxProfile as TaxProfileT, IvaPeriodicidad } from "../../dashboard/tax.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl, CheckCard, CheckCardGrid } from "../../../components/design-system";

const money = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Math.round(n || 0));

const PERIODICIDADES: { value: IvaPeriodicidad; label: string }[] = [
    { value: "bimestral", label: "Bimestral (6 periodos/año)" },
    { value: "cuatrimestral", label: "Cuatrimestral (3 periodos/año)" },
    { value: "no_responsable", label: "No responsable de IVA" },
];

const TaxProfile: React.FC = () => {
    const [profile, setProfile] = useState<TaxProfileT | null>(null);
    const [deteccion, setDeteccion] = useState<{ periodicidad: IvaPeriodicidad; ingresos: number; umbral: number; autodetectado: boolean } | null>(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const cargar = async () => {
        setCargando(true);
        try {
            const r = await getTaxProfile();
            setProfile(r.profile);
            setDeteccion(r.deteccion);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo cargar el perfil tributario");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const set = <K extends keyof TaxProfileT>(key: K, value: TaxProfileT[K]) => {
        setProfile((p) => (p ? { ...p, [key]: value } : p));
    };
    const setNotif = <K extends keyof NonNullable<TaxProfileT["notificaciones"]>>(key: K, value: NonNullable<TaxProfileT["notificaciones"]>[K]) => {
        setProfile((p) => {
            if (!p) return p;
            const base = p.notificaciones ?? { enabled: true, dias_anticipacion: 5, dashboard: true, campana: true, correo: false, emails: [] };
            return { ...p, notificaciones: { ...base, [key]: value } };
        });
    };

    const guardar = async () => {
        if (!profile) return;
        setGuardando(true);
        try {
            const r = await updateTaxProfile(profile);
            setProfile(r.profile);
            successToast("Perfil tributario guardado");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setGuardando(false);
        }
    };

    if (cargando || !profile) {
        return <div className="config-section"><p className="pm-hint"><i className="ri-loader-4-line rotating" /> Cargando perfil tributario…</p></div>;
    }

    const notif = profile.notificaciones ?? { enabled: true, dias_anticipacion: 5, dashboard: true, campana: true, correo: false, emails: [] };

    return (
        <div className="config-section">
            <div className="config-section__head">
                <h2><i className="ri-government-line" /> Perfil tributario</h2>
                <p className="config-section__desc">Define las obligaciones DIAN de tu empresa. El calendario del inicio se arma con estos datos.</p>
            </div>

            {/* Autodetección */}
            {deteccion && (
                <div className="tax-detect">
                    <i className="ri-information-line" />
                    <span>
                        Según tus ingresos del año anterior ({money(deteccion.ingresos)}) vs. el umbral de 92.000 UVT ({money(deteccion.umbral)}),
                        tu IVA debería ser <strong>{deteccion.periodicidad}</strong>.
                        {profile.iva_periodicidad_manual ? " Lo fijaste manualmente." : " (autodetectado)"}
                    </span>
                </div>
            )}

            <div className="led-form-grid tax-form">
                <FilterField label="Periodicidad de IVA" htmlFor="tax-profile-iva" icon="ri-calendar-line">
                    <FieldControl id="tax-profile-iva" as="select" value={profile.iva_periodicidad ?? deteccion?.periodicidad ?? "cuatrimestral"} onChange={(e) => set("iva_periodicidad", e.target.value as IvaPeriodicidad)}>
                        {PERIODICIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </FieldControl>
                </FilterField>

                <FilterField label="Ingresos del año anterior (opcional)" htmlFor="tax-profile-ingresos" icon="ri-money-dollar-circle-line">
                    <FieldControl
                        id="tax-profile-ingresos"
                        type="number"
                        value={profile.ingresos_anio_anterior ?? ""}
                        placeholder="Se calcula del libro mayor si lo dejas vacío"
                        onChange={(e) => set("ingresos_anio_anterior", e.target.value ? Number(e.target.value) : undefined)}
                    />
                </FilterField>

                <CheckCardGrid className="tax-checks">
                    <CheckCard icon="ri-hand-coin-line" label="Agente de retención" description="Declara retefuente mensual, form. 350" checked={!!profile.agente_retencion} onChange={(v) => set("agente_retencion", v)} />
                    <CheckCard icon="ri-vip-crown-line" label="Gran contribuyente" checked={!!profile.gran_contribuyente} onChange={(v) => set("gran_contribuyente", v)} />
                    <CheckCard icon="ri-percent-line" label="Responsable de IVA" checked={profile.responsable_iva !== false} onChange={(v) => set("responsable_iva", v)} />
                    <CheckCard icon="ri-building-2-line" label="Declara ReteICA" description="Retención municipal" checked={!!profile.declara_reteica} onChange={(v) => set("declara_reteica", v)} />
                    <CheckCard icon="ri-store-2-line" label="Declara ICA propio" description="Industria y comercio, bimestral" checked={!!profile.declara_ica} onChange={(v) => set("declara_ica", v)} />
                    <CheckCard icon="ri-refund-2-line" label="Autorretenedor de renta" description="Declaración mensual" checked={!!profile.autorretenedor_renta} onChange={(v) => set("autorretenedor_renta", v)} />
                    <CheckCard icon="ri-file-chart-line" label="Obligado a declarar renta" description="Declaración anual" checked={profile.declara_renta !== false} onChange={(v) => set("declara_renta", v)} />
                    <CheckCard icon="ri-database-2-line" label="Información exógena" description="Medios magnéticos, anual" checked={!!profile.presenta_exogena} onChange={(v) => set("presenta_exogena", v)} />
                    <CheckCard icon="ri-scales-3-line" label="Régimen Simple (RST)" checked={!!profile.regimen_simple} onChange={(v) => set("regimen_simple", v)} />
                </CheckCardGrid>
            </div>

            {/* Notificaciones */}
            <div className="config-section__head" style={{ marginTop: 24 }}>
                <h2><i className="ri-notification-3-line" /> Notificaciones de vencimientos</h2>
                <p className="config-section__desc">Te avisamos antes de cada vencimiento DIAN por los canales que elijas.</p>
            </div>

            <CheckCardGrid className="tax-checks">
                <CheckCard icon="ri-alarm-warning-line" label="Activar avisos de vencimientos" checked={notif.enabled} onChange={(v) => setNotif("enabled", v)} />
            </CheckCardGrid>

            <div className="led-form-grid tax-form">
                <FilterField label="Días de anticipación" htmlFor="tax-notif-dias" icon="ri-time-line">
                    <FieldControl id="tax-notif-dias" type="number" min={1} max={30} value={notif.dias_anticipacion} onChange={(e) => setNotif("dias_anticipacion", Number(e.target.value) || 5)} />
                </FilterField>

                <CheckCardGrid className="tax-checks">
                    <CheckCard icon="ri-dashboard-line" label="En el dashboard" description="Tarjetas de inicio" checked={notif.dashboard} onChange={(v) => setNotif("dashboard", v)} disabled={!notif.enabled} />
                    <CheckCard icon="ri-notification-3-line" label="En la campana" description="Centro de actividades" checked={notif.campana} onChange={(v) => setNotif("campana", v)} disabled={!notif.enabled} />
                    <CheckCard icon="ri-mail-line" label="Por correo electrónico" checked={notif.correo} onChange={(v) => setNotif("correo", v)} disabled={!notif.enabled} />
                </CheckCardGrid>

                {notif.correo && (
                    <FilterField label="Correos destino (separados por coma; vacío = correo de la empresa)" htmlFor="tax-notif-emails" icon="ri-mail-line" className="led-form-grid__full">
                        <FieldControl
                            id="tax-notif-emails"
                            type="text"
                            value={(notif.emails ?? []).join(", ")}
                            placeholder="contador@empresa.com, gerencia@empresa.com"
                            onChange={(e) => setNotif("emails", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                        />
                    </FilterField>
                )}
            </div>

            <div className="tax-actions">
                <button className="btn-primary" onClick={guardar} disabled={guardando}>
                    <i className="ri-save-line" /> {guardando ? "Guardando…" : "Guardar perfil"}
                </button>
            </div>
        </div>
    );
};

export default TaxProfile;
