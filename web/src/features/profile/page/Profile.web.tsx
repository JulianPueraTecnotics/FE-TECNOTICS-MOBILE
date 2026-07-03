import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Profile.css";
import { getProfileService, type CompanyProfileResponse, type CompanyPrefix, type PrefixResolution, type ReceiveBillsReportsPeriod } from "./services/get_profile";
import { getSubscriptionService, type CompanySubscriptionResponse } from "./services/get_subscription";
import departamentos from "../../../utils/departamentos.json";
import municipios from "../../../utils/municipios.json";
import paises from "../../../utils/paises.json";
import { updateLogoService } from "./services/update_logo";
import { updateCompanyInfoService, type UpdateCompanyInfoBody } from "./services/update_company_info";
import { addPrefixService } from "./services/add_prefix";
import { addNominaPrefixService } from "./services/add_nomina_prefix";
import { setDefaultPrefixService } from "./services/set_default_prefix";
import { deletePrefixService } from "./services/delete_prefix";
import { setPrefixStatusService } from "./services/set_prefix_status";
import { fetchSimbaNumberingRange, habilitarFeService, habilitarNominaService, habilitarPosService } from "./services/simba_activation";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { ConfirmModal, UpdateLogoModal } from "../../../components/modals";
import LoadingScreen from "../../../router/LoadingScreen";
import { TipoDocElectronico } from "../../../types";
import { clearLogs, getLogs, type LogEntry } from "../../../services/logger.service";
import SearchableSelect from "../../../components/shared/SearchableSelect/SearchableSelect";
import { FilterField, FieldControl, CheckCard, CheckCardGrid } from "../../../components/design-system";
import PagoButton from "../../../components/ui/PagoButton";
import { PAY_WINDOW_DAYS } from "../../../components/ui/pagoCheckout.shared";

/** Normaliza prefijos legacy sin resolution (el backend puede devolver datos migrados). */
function normalizeResolution(r: PrefixResolution | undefined): PrefixResolution {
    return {
        init: typeof r?.init === "number" && !Number.isNaN(r.init) ? r.init : 1,
        end: typeof r?.end === "number" && !Number.isNaN(r.end) ? r.end : 999999999,
        locked: Array.isArray(r?.locked) ? r.locked.filter((n) => typeof n === "number" && !Number.isNaN(n)) : undefined,
        status: r?.status === "inactive" ? "inactive" : "active",
        start_date: r?.start_date,
        end_date: r?.end_date,
        tipo_doc_electronico: normalizeTipoDocElectronico(r?.tipo_doc_electronico),
        tipo_factura: normalizeTipoFactura(r?.tipo_factura),
        resolution: r?.resolution ?? "",
    };
}

/** Prefijo en borrador local: siempre tiene `resolution` completa. */
type CompanyPrefixDraft = Omit<CompanyPrefix, "resolution"> & { resolution: PrefixResolution };
type TipoDocElectronicoCode = (typeof TipoDocElectronico)[keyof typeof TipoDocElectronico];
/** Códigos canónicos `TipoDeFactura` para resolución de prefijos (API). */
type TipoDeFacturaCode = "01" | "02" | "03" | "04" | "05" | "20" | "92" | "020";
type ProfileSection = "general" | "contact-bank" | "billing-config" | "documents" | "events";
const PROFILE_SECTIONS: ProfileSection[] = ["general", "contact-bank", "billing-config", "documents", "events"];

/**
 * El mismo componente sirve para dos páginas:
 * - "profile" (Mi Perfil): datos de la empresa → Información general y Contacto y banco.
 * - "configuration" (Configuración): Conf. de facturas, Documentos de cuenta y Consola de eventos.
 * Así reutilizamos toda la lógica sin duplicar este componente grande.
 */
type ProfileMode = "profile" | "configuration";
const SECTIONS_BY_MODE: Record<ProfileMode, ProfileSection[]> = {
    profile: ["general", "contact-bank"],
    configuration: ["billing-config", "documents", "events"],
};
const SECTION_LABELS: Record<ProfileSection, string> = {
    general: "Información general",
    "contact-bank": "Contacto y banco",
    "billing-config": "Conf. de facturas",
    documents: "Documentos de cuenta",
    events: "Consola de eventos",
};

function isProfileSection(value: string | null): value is ProfileSection {
    return value != null && PROFILE_SECTIONS.includes(value as ProfileSection);
}

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
    active: "Activa",
    inactive: "Inactiva",
    expired: "Vencida",
};

function formatCurrencyCOP(value: number | undefined): string {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatLongDate(value: string | Date | undefined): string {
    if (!value) return "N/A";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

/** Días restantes hasta `end_date` (negativo si ya venció). `null` si no hay fecha válida. */
function daysUntil(endDate: string | Date | undefined): number | null {
    if (!endDate) return null;
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return null;
    return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const TIPO_DOC_ELECTRONICO_OPTIONS: Array<{ value: TipoDocElectronicoCode; label: string }> = [
    { value: TipoDocElectronico.FACTURA, label: "Factura electrónica" },
    { value: TipoDocElectronico.NOTA_DEBITO, label: "Nota débito" },
    { value: TipoDocElectronico.NOTA_CREDITO, label: "Nota crédito" },
    { value: TipoDocElectronico.DOCUMENTO_SOPORTE, label: "Documento soporte" },
];

const TIPO_FACTURA_OPTIONS: Array<{ value: TipoDeFacturaCode; label: string }> = [
    { value: "01", label: "Factura de venta" },
    { value: "02", label: "Exportación" },
    { value: "03", label: "Contingencia facturador" },
    { value: "04", label: "Contingencia DIAN" },
    { value: "05", label: "Documento soporte" },
    { value: "20", label: "Factura POS" },
    { value: "92", label: "Nota débito" },
    { value: "020", label: "Nota crédito sin referencia" },
];

/** Qué `tipo_factura` aplica según `tipo_doc_electronico` del prefijo (coherencia con API). */
const TIPO_FACTURA_BY_DOC: Record<TipoDocElectronicoCode, TipoDeFacturaCode[]> = {
    "01": ["01", "02", "03", "04", "20"],
    "11": ["05"],
    "02": ["92"],
    "03": ["020"],
};

function normalizeTipoDocElectronico(value?: string): TipoDocElectronicoCode {
    const v = String(value ?? "").trim();
    if (v === "1" || v === "01") return "01";
    if (v === "2" || v === "02") return "02";
    if (v === "3" || v === "03") return "03";
    if (v === "11") return "11";
    return "01";
}

function defaultTipoFacturaForDoc(tipoDoc: TipoDocElectronicoCode): TipoDeFacturaCode {
    const list = TIPO_FACTURA_BY_DOC[tipoDoc];
    return list[0] ?? "01";
}

/** Opciones de select para prefijo; si el valor guardado no está en la lista filtrada, se muestra igualmente. */
function getTipoFacturaOptionsForDoc(tipoDoc: TipoDocElectronicoCode, current?: string) {
    const allowed = TIPO_FACTURA_BY_DOC[tipoDoc] ?? TIPO_FACTURA_BY_DOC["01"];
    const filtered = TIPO_FACTURA_OPTIONS.filter((o) => allowed.includes(o.value));
    const cur = current?.trim();
    if (cur && !filtered.some((o) => o.value === cur)) {
        const extra = TIPO_FACTURA_OPTIONS.find((o) => o.value === cur);
        if (extra) return [extra, ...filtered];
    }
    return filtered.length ? filtered : TIPO_FACTURA_OPTIONS;
}

const BANK_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "Bancolombia", label: "Bancolombia" },
    { value: "Banco de Bogotá", label: "Banco de Bogotá" },
    { value: "Davivienda", label: "Davivienda" },
    { value: "BBVA Colombia", label: "BBVA Colombia" },
    { value: "Banco de Occidente", label: "Banco de Occidente" },
    { value: "Banco Popular", label: "Banco Popular" },
    { value: "Banco AV Villas", label: "Banco AV Villas" },
    { value: "Banco Caja Social", label: "Banco Caja Social" },
    { value: "Banco Agrario de Colombia", label: "Banco Agrario de Colombia" },
    { value: "Citibank Colombia", label: "Citibank Colombia" },
    { value: "Scotiabank Colpatria", label: "Scotiabank Colpatria" },
    { value: "Banco Pichincha Colombia", label: "Banco Pichincha Colombia" },
    { value: "Banco Falabella Colombia", label: "Banco Falabella Colombia" },
    { value: "Banco Santander Colombia", label: "Banco Santander Colombia" },
    { value: "Itaú Colombia", label: "Itaú Colombia" },
    { value: "Banco Cooperativo Coopcentral", label: "Banco Cooperativo Coopcentral" },
];

function normalizeTipoFactura(value?: string): TipoDeFacturaCode {
    const v = String(value ?? "").trim();
    if (v === "020") return "020";
    if (v === "92") return "92";
    switch (v) {
        case "01":
            return "01";
        case "02":
            return "02";
        case "03":
            return "03";
        case "04":
            return "04";
        case "05":
            return "05";
        case "20":
            return "20";
        case "10":
        case "12":
        default:
            return "01";
    }
}

function getTipoDocElectronicoLabel(value?: string): string {
    if (!value) return "-";
    const n = normalizeTipoDocElectronico(value);
    return TIPO_DOC_ELECTRONICO_OPTIONS.find((opt) => opt.value === n)?.label ?? value;
}

function getTipoFacturaLabel(value?: string): string {
    if (!value) return "-";
    const raw = String(value).trim();
    const fromList = TIPO_FACTURA_OPTIONS.find((opt) => opt.value === raw);
    if (fromList) return fromList.label;
    const normalized = normalizeTipoFactura(value);
    return TIPO_FACTURA_OPTIONS.find((opt) => opt.value === normalized)?.label ?? raw;
}

function normalizeCompanyPrefix(p: CompanyPrefix): CompanyPrefixDraft {
    return {
        prefix: p.prefix,
        default: p.default,
        is_nomina: p.is_nomina,
        resolution: normalizeResolution(p.resolution),
    };
}

function parseLockedInput(value: string): number[] | undefined {
    const t = value.trim();
    if (!t) return undefined;
    const nums = t
        .split(/[,;\s]+/)
        .map((x) => parseInt(x.trim(), 10))
        .filter((n) => !Number.isNaN(n));
    return nums.length ? nums : undefined;
}

function toDateInputValue(iso?: string): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

function toIsoFromDate(value: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const date = new Date(`${trimmed}T00:00:00`);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
}

function sanitizeLockedInput(value: string): string {
    return value.replace(/[^\d,\s]/g, "");
}

function formatDateShort(iso?: string): string {
    if (!iso) return "-";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("es-CO");
}

const ProfilePage: React.FC<{ mode?: ProfileMode; embedded?: boolean }> = ({ mode = "profile", embedded = false }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const sectionFromUrl = searchParams.get("tab");
    const visibleSections = SECTIONS_BY_MODE[mode];
    const defaultSection = visibleSections[0];
    /** Una sección de la URL solo aplica si pertenece a este modo. */
    const urlSectionForMode = isProfileSection(sectionFromUrl) && visibleSections.includes(sectionFromUrl) ? sectionFromUrl : null;
    const [profile, setProfile] = useState<CompanyProfileResponse | null>(null);
    const [subscription, setSubscription] = useState<CompanySubscriptionResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
    const [newPrefixInput, setNewPrefixInput] = useState("");
    const [newPrefixInit, setNewPrefixInit] = useState("");
    const [newPrefixEnd, setNewPrefixEnd] = useState("");
    const [newPrefixLocked, setNewPrefixLocked] = useState("");
    const [newPrefixStartDate, setNewPrefixStartDate] = useState("");
    const [newPrefixEndDate, setNewPrefixEndDate] = useState("");
    const [newPrefixTipoDoc, setNewPrefixTipoDoc] = useState<TipoDocElectronicoCode>(TipoDocElectronico.FACTURA);
    const [newPrefixTipoFactura, setNewPrefixTipoFactura] = useState<TipoDeFacturaCode>("01");
    const [newPrefixResolutionCode, setNewPrefixResolutionCode] = useState("");
    /** Checkbox del formulario de alta: si está activo, crea un prefijo de NÓMINA (solo código + consecutivo inicial). */
    const [newPrefixIsNomina, setNewPrefixIsNomina] = useState(false);
    /** Borrador de prefijos para editar resolución antes de PATCH */
    const [draftPrefixes, setDraftPrefixes] = useState<CompanyPrefixDraft[]>([]);
    const [expandedPrefix, setExpandedPrefix] = useState<string | null>(null);
    /** Texto libre para el campo "bloqueados" (evita cortar al escribir comas) */
    const [lockedInputs, setLockedInputs] = useState<Record<string, string>>({});
    const [prefixActionLoading, setPrefixActionLoading] = useState<string | null>(null);
    const [savingPrefixes, setSavingPrefixes] = useState(false);
    const [simbaSetTestId, setSimbaSetTestId] = useState("");
    const [simbaNominaPrefijo, setSimbaNominaPrefijo] = useState("");
    const [simbaActionLoading, setSimbaActionLoading] = useState<"fe" | "pos" | "ne" | null>(null);
    // Token de nómina Simba: se muestra readOnly desde el perfil (no es estado editable).
    const simbaNominaToken = profile?.company?.simba_token ?? "";
    const [numberingRangeLoading, setNumberingRangeLoading] = useState(false);
    const [numberingRangePayload, setNumberingRangePayload] = useState<unknown>(null);
    const [deletePrefixModal, setDeletePrefixModal] = useState<{ open: boolean; prefix: string | null }>({
        open: false,
        prefix: null,
    });
    const [editedData, setEditedData] = useState<{
        phone?: string;
        website?: string;
        address_value?: string;
        departamento_codigo?: string;
        ciudad_codigo?: string;
        pais_codigo?: string;
        zip_code?: string;
        bank_account_name?: string;
        bank_account_number?: string;
        bank_account_type?: "ahorro" | "corriente";
        observations?: string;
    }>({});
    const [isSaving, setIsSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<ProfileSection>(urlSectionForMode ?? defaultSection);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [isLogsPageFetching, setIsLogsPageFetching] = useState(false);
    const [logsPage, setLogsPage] = useState(1);
    const [logsTotalPages, setLogsTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);
    const [isClearingLogs, setIsClearingLogs] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
    const [receiveBillsReportsEnabled, setReceiveBillsReportsEnabled] = useState(false);
    const [receiveBillsReportsPeriod, setReceiveBillsReportsPeriod] = useState<keyof ReceiveBillsReportsPeriod>("daily");
    /** Catálogo de emails visibles en UI (checklist). */
    const [receiveBillsReportsEmailCatalog, setReceiveBillsReportsEmailCatalog] = useState<string[]>([]);
    /** Emails seleccionados: estos son los que se envían al backend. */
    const [receiveBillsReportsSelectedEmails, setReceiveBillsReportsSelectedEmails] = useState<string[]>([]);
    const [newReceiveBillsReportsEmail, setNewReceiveBillsReportsEmail] = useState("");
    const [savingReceiveBillsReports, setSavingReceiveBillsReports] = useState(false);

    const normalizeReceiveBillsReportsPeriod = (period: Partial<ReceiveBillsReportsPeriod> | undefined) => {
        const daily = Boolean(period?.daily);
        const weekly = Boolean(period?.weekly);
        const monthly = Boolean(period?.monthly);
        const trues = [daily, weekly, monthly].filter(Boolean).length;
        if (trues === 1) {
            if (daily) return "daily" as const;
            if (weekly) return "weekly" as const;
            return "monthly" as const;
        }
        // Si viene vacío o inválido, dejamos un default seguro para UI.
        return "daily" as const;
    };

    const buildReceiveBillsReportsPeriodPayload = (selected: keyof ReceiveBillsReportsPeriod) => {
        return {
            daily: selected === "daily",
            weekly: selected === "weekly",
            monthly: selected === "monthly",
        } satisfies ReceiveBillsReportsPeriod;
    };

    const normalizeEmail = (value: string) => value.trim().toLowerCase();
    const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

    const getProfile = async (is_rep: boolean = false) => {
        if (!is_rep) setIsLoading(true);
        try {
            const profile = await getProfileService();
            if (!is_rep) setIsLoading(false);
            setProfile(profile);
        } catch (error: unknown) {
            if (!is_rep) setIsLoading(false);
            console.error(error instanceof Error ? error.message : error);
        } finally {
            setIsLoading(false);
        }
    };
    const getSubscription = async () => {
        try {
            const data = await getSubscriptionService();
            setSubscription(data);
        } catch (error: unknown) {
            console.error(error instanceof Error ? error.message : error);
            setSubscription(null);
        }
    };

    const handleLogoModalSuccess = async (file: File) => {
        try {
            const response = await updateLogoService(file);
            successToast(response.message);
            await getProfile();
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al actualizar el logo");
            throw error;
        }
    };

    useEffect(() => {
        getProfile();
        getSubscription();
    }, []);

    useEffect(() => {
        const cfg = profile?.company?.config?.receive_bills_reports;
        const enabled = Boolean(cfg?.enabled);
        setReceiveBillsReportsEnabled(enabled);
        const nextPeriod = normalizeReceiveBillsReportsPeriod(cfg?.period);
        setReceiveBillsReportsPeriod(nextPeriod);
        const cfgEmails = Array.isArray(cfg?.emails) ? cfg!.emails.filter((e) => typeof e === "string").map(normalizeEmail) : [];
        setReceiveBillsReportsEmailCatalog(cfgEmails);
        setReceiveBillsReportsSelectedEmails(cfgEmails);
    }, [profile?.company?.config?.receive_bills_reports]);

    useEffect(() => {
        // Solo aceptamos de la URL una sección que pertenezca a este modo.
        if (!urlSectionForMode) return;
        if (urlSectionForMode !== activeSection) {
            setActiveSection(urlSectionForMode);
        }
    }, [urlSectionForMode, activeSection]);

    const handleSectionChange = (section: ProfileSection) => {
        setActiveSection(section);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("tab", section);
            return params;
        });
    };

    useEffect(() => {
        const prefixes = profile?.company?.prefixes;
        if (prefixes?.length) {
            const drafts = prefixes.map(normalizeCompanyPrefix);
            setDraftPrefixes(drafts);
            if (expandedPrefix && !drafts.some((p) => p.prefix === expandedPrefix)) {
                setExpandedPrefix(null);
            }
            const locks: Record<string, string> = {};
            for (const p of drafts) {
                locks[p.prefix] = (p.resolution.locked ?? []).join(", ");
            }
            setLockedInputs(locks);
        } else {
            setDraftPrefixes([]);
            setLockedInputs({});
        }
    }, [profile?.company?.prefixes, expandedPrefix]);

    // Preselecciona el prefijo de nómina (el marcado por defecto, o el primero) para la habilitación Simba.
    useEffect(() => {
        const nominaPrefixes = draftPrefixes.filter((p) => p.is_nomina);
        if (!nominaPrefixes.length) {
            if (simbaNominaPrefijo) setSimbaNominaPrefijo("");
            return;
        }
        if (!nominaPrefixes.some((p) => p.prefix === simbaNominaPrefijo)) {
            const preferred = nominaPrefixes.find((p) => p.default) ?? nominaPrefixes[0];
            setSimbaNominaPrefijo(preferred.prefix);
        }
    }, [draftPrefixes, simbaNominaPrefijo]);

    useEffect(() => {
        setNewPrefixTipoFactura((prev) => {
            const allowed = TIPO_FACTURA_BY_DOC[newPrefixTipoDoc];
            if (allowed.includes(prev)) return prev;
            return defaultTipoFacturaForDoc(newPrefixTipoDoc);
        });
    }, [newPrefixTipoDoc]);

    const handleAddPrefix = async () => {
        const prefix = newPrefixInput.trim().toUpperCase();
        if (!prefix) return;
        const init = parseInt(newPrefixInit, 10);

        // Modo nómina: solo requiere prefijo + consecutivo inicial (sin resolución DIAN).
        if (newPrefixIsNomina) {
            if (Number.isNaN(init) || init < 1) {
                errorToast("El consecutivo inicial debe ser un número mayor o igual a 1");
                return;
            }
            if (prefix.length > 5) {
                errorToast("El prefijo de nómina admite máximo 5 caracteres");
                return;
            }
            setPrefixActionLoading("add");
            try {
                await addNominaPrefixService({ prefix, consecutivo_inicial: init });
                successToast("Prefijo de nómina añadido correctamente");
                setNewPrefixInput("");
                setNewPrefixInit("");
                setNewPrefixIsNomina(false);
                await getProfile(true);
            } catch (error: unknown) {
                errorToast(error instanceof Error ? error.message : "Error al añadir el prefijo de nómina");
            } finally {
                setPrefixActionLoading(null);
            }
            return;
        }

        const resolutionCode = newPrefixResolutionCode.trim();
        const end = parseInt(newPrefixEnd, 10);
        const startDateIso = toIsoFromDate(newPrefixStartDate);
        const endDateIso = toIsoFromDate(newPrefixEndDate);
        if (Number.isNaN(init) || init < 1) {
            errorToast("El inicio (init) debe ser un número mayor o igual a 1");
            return;
        }
        if (Number.isNaN(end) || end < init) {
            errorToast("El fin (end) debe ser mayor o igual al inicio");
            return;
        }
        if (!startDateIso) {
            errorToast("Debes indicar una fecha de inicio válida");
            return;
        }
        if (!endDateIso) {
            errorToast("Debes indicar una fecha de vencimiento válida");
            return;
        }
        if (new Date(endDateIso).getTime() < new Date(startDateIso).getTime()) {
            errorToast("La fecha de vencimiento debe ser mayor o igual a la fecha de inicio");
            return;
        }
        if (!resolutionCode) {
            errorToast("Debes indicar el número/código de resolución");
            return;
        }
        const locked = parseLockedInput(newPrefixLocked);
        setPrefixActionLoading("add");
        try {
            await addPrefixService({
                prefix,
                resolution: {
                    init,
                    end,
                    ...(locked?.length ? { locked } : {}),
                    status: "active",
                    start_date: startDateIso,
                    end_date: endDateIso,
                    tipo_doc_electronico: newPrefixTipoDoc,
                    tipo_factura: newPrefixTipoFactura,
                    resolution: resolutionCode,
                },
            });
            successToast("Prefijo añadido correctamente");
            setNewPrefixInput("");
            setNewPrefixInit("");
            setNewPrefixEnd("");
            setNewPrefixLocked("");
            setNewPrefixStartDate("");
            setNewPrefixEndDate("");
            setNewPrefixTipoDoc(TipoDocElectronico.FACTURA);
            setNewPrefixTipoFactura("01");
            setNewPrefixResolutionCode("");
            await getProfile(true);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al añadir el prefijo");
        } finally {
            setPrefixActionLoading(null);
        }
    };

    const updateDraftResolution = (prefixCode: string, field: "init" | "end", value: number) => {
        setDraftPrefixes((prev) =>
            prev.map((item) => {
                if (item.prefix !== prefixCode) return item;
                const base = normalizeResolution(item.resolution);
                const next: PrefixResolution = { ...base, [field]: value };
                return { ...item, resolution: next };
            }),
        );
    };

    const updateDraftResolutionSelect = (prefixCode: string, field: "tipo_doc_electronico" | "tipo_factura", value: string) => {
        setDraftPrefixes((prev) =>
            prev.map((item) => {
                if (item.prefix !== prefixCode) return item;
                const base = normalizeResolution(item.resolution);
                const next: PrefixResolution = field === "tipo_factura" ? { ...base, tipo_factura: normalizeTipoFactura(value) } : { ...base, tipo_doc_electronico: value as TipoDocElectronicoCode };
                return { ...item, resolution: next };
            }),
        );
    };

    const handleSavePrefixResolutions = async () => {
        for (const item of draftPrefixes) {
            const { init, end } = item.resolution;
            if (init < 1 || end < init) {
                errorToast(`Prefijo ${item.prefix}: revisa inicio y fin de la resolución`);
                return;
            }
        }
        setSavingPrefixes(true);
        try {
            const payload: CompanyPrefix[] = draftPrefixes.map((p) => {
                const locked = parseLockedInput(lockedInputs[p.prefix] ?? "");
                const res = p.resolution;
                return {
                    prefix: p.prefix,
                    default: p.default,
                    is_nomina: p.is_nomina,
                    resolution: {
                        init: res.init,
                        end: res.end,
                        ...(locked?.length ? { locked } : {}),
                        status: res.status ?? "active",
                        start_date: res.start_date,
                        end_date: res.end_date,
                        tipo_doc_electronico: res.tipo_doc_electronico,
                        tipo_factura: res.tipo_factura,
                        resolution: res.resolution,
                    },
                };
            });
            await updateCompanyInfoService({ prefixes: payload });
            successToast("Resoluciones de prefijos actualizadas");
            await getProfile(true);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al guardar prefijos");
        } finally {
            setSavingPrefixes(false);
        }
    };

    const handleSetDefaultPrefix = async (prefix: string) => {
        setPrefixActionLoading(`default-${prefix}`);
        try {
            await setDefaultPrefixService({ prefix });
            successToast("Prefijo por defecto actualizado");
            await getProfile(true);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al establecer el prefijo por defecto");
        } finally {
            setPrefixActionLoading(null);
        }
    };

    const handleTogglePrefixStatus = async (item: CompanyPrefixDraft) => {
        const nextStatus = item.resolution.status === "inactive" ? "active" : "inactive";
        setPrefixActionLoading(`status-${item.prefix}`);
        try {
            await setPrefixStatusService({ prefix: item.prefix, status: nextStatus });
            successToast(`Prefijo ${item.prefix} ${nextStatus === "active" ? "activado" : "desactivado"}`);
            await getProfile(true);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al actualizar estado del prefijo");
        } finally {
            setPrefixActionLoading(null);
        }
    };

    const handleDeletePrefix = async (prefix: string) => {
        setPrefixActionLoading(`delete-${prefix}`);
        try {
            await deletePrefixService(prefix);
            successToast("Prefijo eliminado");
            await getProfile(true);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al eliminar el prefijo");
        } finally {
            setPrefixActionLoading(null);
        }
    };

    const openDeletePrefixModal = (prefix: string) => {
        setDeletePrefixModal({ open: true, prefix });
    };

    const closeDeletePrefixModal = () => {
        setDeletePrefixModal({ open: false, prefix: null });
    };

    const confirmDeletePrefix = async () => {
        const prefix = deletePrefixModal.prefix;
        if (!prefix) return;
        await handleDeletePrefix(prefix);
        closeDeletePrefixModal();
    };

    const handleSimbaActivation = async (type: "fe" | "pos" | "ne") => {
        const setTestId = simbaSetTestId.trim();
        const nominaPrefijo = simbaNominaPrefijo.trim();
        const nominaToken = simbaNominaToken.trim();
        // La nómina no usa SetTestId (NIT, DV y razón social se arman con los datos de la empresa en el backend).
        if (type !== "ne" && !setTestId) {
            errorToast("Debes ingresar el SetTestId");
            return;
        }
        if (type === "ne" && !nominaPrefijo) {
            errorToast("Debes seleccionar el prefijo de nómina a habilitar");
            return;
        }
        if (type === "ne" && !nominaToken) {
            errorToast("Debes ingresar el token de habilitación de nómina");
            return;
        }
        setSimbaActionLoading(type);
        try {
            const response = type === "fe" ? await habilitarFeService({ setTestId }) : type === "pos" ? await habilitarPosService({ setTestId }) : await habilitarNominaService({ prefijo: nominaPrefijo, token: nominaToken });
            if (response.Error) {
                errorToast(response.Msg || "Simba devolvió un error");
                return;
            }
            successToast(response.Msg || "Proceso ejecutado correctamente");
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al ejecutar habilitación Simba");
        } finally {
            setSimbaActionLoading(null);
        }
    };

    const handleFetchNumberingRange = async () => {
        setNumberingRangeLoading(true);
        try {
            const data = await fetchSimbaNumberingRange();
            setNumberingRangePayload(data);
        } catch (error: unknown) {
            setNumberingRangePayload(null);
            errorToast(error instanceof Error ? error.message : "Error al consultar rangos de numeración");
        } finally {
            setNumberingRangeLoading(false);
        }
    };

    const loadLogs = useCallback(async () => {
        if (logs.length > 0) {
            setIsLogsPageFetching(true);
        } else {
            setLogsLoading(true);
        }
        try {
            const response = await getLogs(logsPage, 20);
            if (response?.ok && response.logs) {
                setLogs(response.logs);
                setLogsTotalPages(response.pagination?.totalPages ?? 1);
                setTotalLogs(response.pagination?.total ?? 0);
            }
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al cargar el registro de actividad");
        } finally {
            setLogsLoading(false);
            setIsLogsPageFetching(false);
        }
    }, [logsPage, logs.length]);

    useEffect(() => {
        if (activeSection === "events") {
            loadLogs();
        }
    }, [activeSection, loadLogs]);

    const handleClearLogs = async () => {
        setIsClearingLogs(true);
        try {
            const response = await clearLogs();
            if (response?.ok) {
                successToast(response.message ?? "Historial vaciado correctamente");
                setIsClearLogsModalOpen(false);
                setLogsPage(1);
                await loadLogs();
            }
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al vaciar el historial");
        } finally {
            setIsClearingLogs(false);
        }
    };

    const formatConsoleTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    };

    const formatConsoleDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    };

    const handleSaveProfile = async (options?: { observations?: string }) => {
        if (!profile) return;
        const data = options?.observations !== undefined ? { ...editedData, observations: options.observations } : editedData;
        const hasContactChanges = data.phone !== undefined || data.website !== undefined;
        const hasAddressChanges = data.address_value !== undefined || data.ciudad_codigo !== undefined || data.departamento_codigo !== undefined || data.pais_codigo !== undefined || data.zip_code !== undefined;
        const hasBankAccountChanges = data.bank_account_name !== undefined || data.bank_account_number !== undefined || data.bank_account_type !== undefined;
        const hasObservationsChanges = data.observations !== undefined;

        if (!hasContactChanges && !hasAddressChanges && !hasBankAccountChanges && !hasObservationsChanges) {
            successToast("No hay cambios que guardar");
            return;
        }

        setIsSaving(true);
        try {
            const body: Record<string, unknown> = {};
            if (hasContactChanges) {
                if (data.phone !== undefined) body.phone = data.phone;
                if (data.website !== undefined) body.website = data.website;
            }
            if (hasAddressChanges) {
                body.address = {
                    value: data.address_value ?? profile.company.address.value,
                    ciudad_codigo: data.ciudad_codigo ?? profile.company.address.ciudad_codigo,
                    departamento_codigo: data.departamento_codigo ?? profile.company.address.departamento_codigo,
                    pais_codigo: data.pais_codigo ?? profile.company.address.pais_codigo,
                    zip_code: data.zip_code ?? profile.company.address.zip_code ?? "",
                };
            }
            if (hasBankAccountChanges) {
                body.bank_account = {
                    name: data.bank_account_name ?? profile.company.bank_account?.name ?? "",
                    account_number: data.bank_account_number ?? profile.company.bank_account?.account_number ?? "",
                    account_type: data.bank_account_type ?? profile.company.bank_account?.account_type ?? "ahorro",
                };
            }
            if (hasObservationsChanges) {
                body.observations = data.observations ?? profile.company.observations ?? "";
            }
            await updateCompanyInfoService(body as UpdateCompanyInfoBody);
            successToast("Información actualizada correctamente");
            setEditedData({});
            await getProfile(true);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al guardar");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFillObservationsWithBankAndSave = async () => {
        if (!profile) return;
        const bankName = (editedData.bank_account_name ?? profile.company.bank_account?.name ?? "").trim();
        const accountNumber = (editedData.bank_account_number ?? profile.company.bank_account?.account_number ?? "").trim();
        const accountTypeRaw = editedData.bank_account_type ?? profile.company.bank_account?.account_type;
        const accountTypeLabel = accountTypeRaw === "corriente" ? "Corriente" : accountTypeRaw === "ahorro" ? "Ahorro" : "";

        if (!bankName || !accountNumber || !accountTypeLabel) {
            errorToast("Indica banco, tipo de cuenta y número de cuenta en Información Bancaria.");
            return;
        }

        const observationsText = `Favor consignar a ${bankName} ${accountTypeLabel} con número de cuenta ${accountNumber}`;
        setEditedData((prev) => ({ ...prev, observations: observationsText }));
        await handleSaveProfile({ observations: observationsText });
    };

    const handleUpdateReceiveBillsReports = async (nextEnabled: boolean, nextPeriod?: keyof ReceiveBillsReportsPeriod, nextEmails?: string[]) => {
        if (!profile) return;
        setSavingReceiveBillsReports(true);
        try {
            const emailsPayload = (nextEmails ?? receiveBillsReportsSelectedEmails).map(normalizeEmail).filter((e) => e.length > 0);
            const body: UpdateCompanyInfoBody = {
                config: {
                    receive_bills_reports: nextEnabled
                        ? {
                              enabled: true,
                              emails: emailsPayload,
                              period: buildReceiveBillsReportsPeriodPayload(nextPeriod ?? receiveBillsReportsPeriod),
                          }
                        : { enabled: false },
                },
            };
            await updateCompanyInfoService(body);
            successToast("Configuración de reportes actualizada");
            await getProfile(true);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al actualizar reportes");
        } finally {
            setSavingReceiveBillsReports(false);
        }
    };

    const primaryReportEmail = profile?.company.email ? normalizeEmail(profile.company.email) : "";

    const addPrimaryEmailToRecipientsList = () => {
        if (!primaryReportEmail) {
            errorToast("No hay correo principal configurado en la cuenta");
            return;
        }
        if (receiveBillsReportsEmailCatalog.includes(primaryReportEmail)) {
            if (!receiveBillsReportsSelectedEmails.includes(primaryReportEmail)) {
                const nextSelected = [...receiveBillsReportsSelectedEmails, primaryReportEmail];
                setReceiveBillsReportsSelectedEmails(nextSelected);
                if (receiveBillsReportsEnabled) {
                    void handleUpdateReceiveBillsReports(true, receiveBillsReportsPeriod, nextSelected);
                }
            }
            return;
        }
        const nextCatalog = [...receiveBillsReportsEmailCatalog, primaryReportEmail];
        const nextSelected = [...receiveBillsReportsSelectedEmails, primaryReportEmail];
        setReceiveBillsReportsEmailCatalog(nextCatalog);
        setReceiveBillsReportsSelectedEmails(nextSelected);
        if (receiveBillsReportsEnabled) {
            void handleUpdateReceiveBillsReports(true, receiveBillsReportsPeriod, nextSelected);
        }
    };

    if (isLoading) {
        return <LoadingScreen />;
    }

    return (
        <main className="profile-page">
            <div className="profile-container">
                {!embedded && (
                    <div className="profile-header">
                        <h1>{mode === "configuration" ? "Configuración" : "Mi Perfil"}</h1>
                        <p>{mode === "configuration" ? "Configuración de facturación, documentos y eventos de tu empresa" : "Información de tu cuenta empresarial"}</p>
                    </div>
                )}

                <div className={`profile-content ${embedded ? "" : "profile-content-with-sidebar"}`}>
                    {!embedded && (
                        <aside className="profile-sections-sidebar">
                            {visibleSections.map((section) => (
                                <button
                                    key={section}
                                    type="button"
                                    className={`profile-section-tab ${activeSection === section ? "active" : ""}`}
                                    onClick={() => handleSectionChange(section)}
                                >
                                    {SECTION_LABELS[section]}
                                </button>
                            ))}
                        </aside>
                    )}
                    <div className="profile-section-content">
                        {activeSection === "general" && (
                            <>
                                <div className="profile-card">
                                    <div className="profile-avatar-section">
                                        <div className="profile-avatar-large">
                                            <img
                                                src={profile?.company.logo.url || ""}
                                                alt="logo empresa"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setIsLogoModalOpen(true)}
                                        >
                                            <i className="ri-upload-2-line"></i>
                                            Cambiar foto
                                        </button>
                                    </div>

                                    <div className="profile-info-section">
                                        <h2>Información General</h2>
                                        <div className="led-form-grid">
                                            <FilterField label="Razón Social" htmlFor="profile-razon-social" icon="ri-building-line">
                                                <FieldControl id="profile-razon-social" type="text" value={profile?.company.razon_social || "N/A"} readOnly />
                                            </FilterField>
                                            <FilterField label="Tipo de Documento" htmlFor="profile-doc-type" icon="ri-id-card-line">
                                                <FieldControl id="profile-doc-type" type="text" value={profile?.company.doc_type.value || "N/A"} readOnly />
                                            </FilterField>
                                            <FilterField label="Número de Documento" htmlFor="profile-doc-number" icon="ri-hashtag">
                                                <FieldControl
                                                    id="profile-doc-number"
                                                    type="text"
                                                    value={`${profile?.company.doc_number || ""}${profile?.company.doc_number_dv ? `-${profile.company.doc_number_dv}` : ""}`}
                                                    readOnly
                                                />
                                            </FilterField>
                                            <div className="info-item">
                                                <label>Estado de Cuenta</label>
                                                <span className="status-badge-active">{profile?.company.active ? "Activa" : "Inactiva"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="profile-card profile-subscription-card">
                                    <div className="profile-info-section">
                                        <div className="subscription-header">
                                            <h2>Suscripción</h2>
                                            {subscription?.suscription?.status ? (
                                                <span className={`subscription-status subscription-status-${subscription.suscription.status}`}>
                                                    {SUBSCRIPTION_STATUS_LABELS[subscription.suscription.status] ?? subscription.suscription.status}
                                                </span>
                                            ) : null}
                                        </div>

                                        {subscription ? (
                                            <>
                                                <div className="led-form-grid">
                                                    <FilterField label="Plan" htmlFor="profile-plan" icon="ri-vip-crown-line">
                                                        <FieldControl id="profile-plan" type="text" value={subscription.plan?.title || "N/A"} readOnly />
                                                    </FilterField>
                                                    <FilterField label="Fecha de inicio" htmlFor="profile-sub-start" icon="ri-calendar-line">
                                                        <FieldControl id="profile-sub-start" type="text" value={formatLongDate(subscription.suscription.start_date)} readOnly />
                                                    </FilterField>
                                                    <FilterField label="Fecha de vencimiento" htmlFor="profile-sub-end" icon="ri-calendar-check-line">
                                                        <FieldControl id="profile-sub-end" type="text" value={formatLongDate(subscription.suscription.end_date)} readOnly />
                                                    </FilterField>
                                                    <FilterField label="Documentos usados" htmlFor="profile-sub-docs" icon="ri-file-list-3-line">
                                                        <FieldControl
                                                            id="profile-sub-docs"
                                                            type="text"
                                                            value={`${subscription.suscription.used_documents ?? 0} / ${subscription.suscription.total_documents ?? 0}`}
                                                            readOnly
                                                        />
                                                    </FilterField>
                                                    <FilterField label="Valor del plan" htmlFor="profile-sub-price" icon="ri-money-dollar-circle-line">
                                                        <FieldControl id="profile-sub-price" type="text" value={formatCurrencyCOP(subscription.suscription.total_price)} readOnly />
                                                    </FilterField>
                                                    <FilterField label="Último pago" htmlFor="profile-sub-last-pay" icon="ri-bank-card-line">
                                                        <FieldControl id="profile-sub-last-pay" type="text" value={formatLongDate(subscription.suscription.last_payment_date)} readOnly />
                                                    </FilterField>
                                                </div>

                                                <div className="subscription-pay">
                                                    {(() => {
                                                        const days = daysUntil(subscription.suscription.end_date);
                                                        if (days == null) return null;
                                                        if (days < 0) {
                                                            return (
                                                                <p className="subscription-pay-note subscription-pay-note-danger">
                                                                    Tu suscripción venció hace {Math.abs(days)} día(s). Renueva para seguir facturando.
                                                                </p>
                                                            );
                                                        }
                                                        if (days <= PAY_WINDOW_DAYS) {
                                                            return (
                                                                <p className="subscription-pay-note subscription-pay-note-warning">
                                                                    Tu suscripción vence en {days} día(s). Ya puedes renovar tu pago.
                                                                </p>
                                                            );
                                                        }
                                                        return (
                                                            <p className="subscription-pay-note">
                                                                El pago se habilita {PAY_WINDOW_DAYS} días antes del vencimiento ({formatLongDate(subscription.suscription.end_date)}).
                                                            </p>
                                                        );
                                                    })()}
                                                    <PagoButton
                                                        current_subscription={subscription.suscription}
                                                        company_name={profile?.company.razon_social || ""}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <p className="subscription-empty">No se encontró una suscripción registrada para esta empresa.</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeSection === "contact-bank" && (
                            <>
                                <div className="profile-card">
                                    <h2>Información de contacto y banco</h2>
                                    <div className="led-form-grid">
                                        <FilterField label="Email" htmlFor="profile-email" icon="ri-mail-line">
                                            <FieldControl id="profile-email" type="email" value={profile?.company.email || ""} readOnly disabled />
                                        </FilterField>
                                        <FilterField label="Teléfono" htmlFor="profile-phone" icon="ri-phone-line">
                                            <FieldControl
                                                id="profile-phone"
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={editedData.phone ?? (profile?.company.phone || "")}
                                                onChange={(e) => setEditedData({ ...editedData, phone: e.target.value.replace(/\D/g, "") })}
                                            />
                                        </FilterField>
                                        <FilterField label="Sitio Web" htmlFor="profile-website" icon="ri-global-line">
                                            <FieldControl
                                                id="profile-website"
                                                type="url"
                                                value={editedData.website ?? (profile?.company.website || "")}
                                                onChange={(e) => setEditedData({ ...editedData, website: e.target.value })}
                                            />
                                        </FilterField>
                                        <FilterField label="Dirección (Descripción)" htmlFor="profile-address" icon="ri-map-pin-line" className="led-form-grid__full">
                                            <FieldControl
                                                id="profile-address"
                                                as="textarea"
                                                value={editedData.address_value ?? (profile?.company.address.value || "")}
                                                onChange={(e) => setEditedData({ ...editedData, address_value: e.target.value })}
                                                rows={3}
                                            />
                                        </FilterField>
                                        <FilterField label="País" htmlFor="profile-pais" icon="ri-earth-line">
                                            <FieldControl
                                                id="profile-pais"
                                                as="select"
                                                value={editedData.pais_codigo ?? (profile?.company.address.pais_codigo || "")}
                                                onChange={(e) => setEditedData({ ...editedData, pais_codigo: e.target.value })}
                                            >
                                                <option value="">Seleccione un país</option>
                                                {paises.map((pais) => (
                                                    <option key={pais.codigo} value={pais.codigo}>
                                                        {pais.descripcion}
                                                    </option>
                                                ))}
                                            </FieldControl>
                                        </FilterField>
                                        <FilterField label="Departamento" htmlFor="profile-depto" icon="ri-map-2-line">
                                            <FieldControl
                                                id="profile-depto"
                                                as="select"
                                                value={editedData.departamento_codigo ?? (profile?.company.address.departamento_codigo || "")}
                                                onChange={(e) => setEditedData({ ...editedData, departamento_codigo: e.target.value, ciudad_codigo: "" })}
                                            >
                                                <option value="">Seleccione un departamento</option>
                                                {departamentos.map((depto) => (
                                                    <option key={depto.codigo} value={depto.codigo}>
                                                        {depto.nombre}
                                                    </option>
                                                ))}
                                            </FieldControl>
                                        </FilterField>
                                        <FilterField label="Ciudad/Municipio" htmlFor="profile-ciudad" icon="ri-building-2-line">
                                            <FieldControl
                                                id="profile-ciudad"
                                                as="select"
                                                value={editedData.ciudad_codigo ?? (profile?.company.address.ciudad_codigo || "")}
                                                onChange={(e) => setEditedData({ ...editedData, ciudad_codigo: e.target.value })}
                                                disabled={!editedData.departamento_codigo && !profile?.company.address.departamento_codigo}
                                            >
                                                <option value="">Seleccione una ciudad</option>
                                                {municipios
                                                    .filter((mun) => mun.code.startsWith(editedData.departamento_codigo ?? (profile?.company.address.departamento_codigo || "")))
                                                    .map((mun) => (
                                                        <option key={mun.code} value={mun.code}>
                                                            {mun.name}
                                                        </option>
                                                    ))}
                                            </FieldControl>
                                        </FilterField>
                                        <FilterField label="Código Postal" htmlFor="profile-zip" icon="ri-mail-send-line">
                                            <FieldControl
                                                id="profile-zip"
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={editedData.zip_code ?? (profile?.company.address.zip_code || "")}
                                                onChange={(e) => setEditedData({ ...editedData, zip_code: e.target.value.replace(/\D/g, "") })}
                                            />
                                        </FilterField>
                                    </div>
                                </div>

                                <div className="profile-card">
                                    <h2>Información Bancaria</h2>
                                    <div className="led-form-grid">
                                        <FilterField label="Banco" htmlFor="profile-bank" icon="ri-bank-line">
                                            <SearchableSelect
                                                embedded
                                                id="profile-bank"
                                                options={BANK_OPTIONS}
                                                value={editedData.bank_account_name ?? (profile?.company.bank_account?.name || "")}
                                                onChange={(value) => setEditedData({ ...editedData, bank_account_name: value })}
                                                placeholder="Buscar o seleccionar banco..."
                                                aria-label="Seleccionar banco"
                                            />
                                        </FilterField>
                                        <FilterField label="Número de Cuenta" htmlFor="profile-bank-number" icon="ri-hashtag">
                                            <FieldControl
                                                id="profile-bank-number"
                                                type="text"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                value={editedData.bank_account_number ?? (profile?.company.bank_account?.account_number || "")}
                                                onChange={(e) => setEditedData({ ...editedData, bank_account_number: e.target.value.replace(/\D/g, "") })}
                                            />
                                        </FilterField>
                                        <FilterField label="Tipo de Cuenta" htmlFor="profile-bank-type" icon="ri-wallet-3-line">
                                            <FieldControl
                                                id="profile-bank-type"
                                                as="select"
                                                value={editedData.bank_account_type ?? (profile?.company.bank_account?.account_type || "")}
                                                onChange={(e) =>
                                                    setEditedData({
                                                        ...editedData,
                                                        bank_account_type: (e.target.value as "ahorro" | "corriente") || undefined,
                                                    })
                                                }
                                            >
                                                <option value="">Seleccione...</option>
                                                <option value="ahorro">Ahorro</option>
                                                <option value="corriente">Corriente</option>
                                            </FieldControl>
                                        </FilterField>
                                    </div>
                                </div>
                                <div className="profile-card">
                                    <h2>Observaciones para la factura</h2>
                                    <div className="info-grid">
                                        <div className="info-item full-width observations-fill-row">
                                            <button
                                                type="button"
                                                className="btn-secondary observations-fill-bank-btn"
                                                onClick={() => void handleFillObservationsWithBankAndSave()}
                                                disabled={isSaving}
                                            >
                                                Rellenar con información bancaria
                                            </button>
                                            <FilterField label="Observaciones para la factura" htmlFor="profile-observations" icon="ri-file-text-line" className="led-form-grid__full">
                                                <FieldControl
                                                    id="profile-observations"
                                                    as="textarea"
                                                    className="observations-textarea"
                                                    placeholder="Observaciones adicionales..."
                                                    value={editedData.observations ?? profile?.company.observations ?? ""}
                                                    onChange={(e) => setEditedData({ ...editedData, observations: e.target.value })}
                                                    rows={4}
                                                />
                                            </FilterField>
                                        </div>
                                    </div>
                                </div>
                                <div className="profile-actions">
                                    <button
                                        type="button"
                                        className="btn-primary btn-full-width"
                                        onClick={() => void handleSaveProfile()}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? "Guardando…" : "Guardar Información"}
                                    </button>
                                </div>
                            </>
                        )}

                        {activeSection === "general" && (
                            <div className="profile-card">
                                <h2>Representante Legal</h2>
                                <div className="led-form-grid">
                                    <FilterField label="Nombre Completo" htmlFor="profile-legal-name" icon="ri-user-line">
                                        <FieldControl id="profile-legal-name" type="text" value={profile?.company.legal_representative.name || ""} readOnly />
                                    </FilterField>
                                    <FilterField label="Tipo de Documento" htmlFor="profile-legal-doc-type" icon="ri-id-card-line">
                                        <FieldControl id="profile-legal-doc-type" type="text" value={profile?.company.legal_representative.doc_type || ""} readOnly />
                                    </FilterField>
                                    <FilterField label="Número de Documento" htmlFor="profile-legal-doc-number" icon="ri-hashtag">
                                        <FieldControl id="profile-legal-doc-number" type="text" value={profile?.company.legal_representative.doc_number || ""} readOnly />
                                    </FilterField>
                                </div>
                            </div>
                        )}

                        {activeSection === "billing-config" && (
                            <>
                                <div className="profile-card">
                                    <h2>Configuración de Facturación</h2>
                                    <div className="info-grid">
                                        <div className="info-item full-width">
                                            <label>Reportes de facturación por email</label>
                                            <div className="billing-reports-card">
                                                <div className="billing-reports-row">
                                                    <span className="billing-reports-label">Recibir reportes</span>
                                                    <label className="toggle">
                                                        <input
                                                            type="checkbox"
                                                            checked={receiveBillsReportsEnabled}
                                                            onChange={(e) => {
                                                                const next = e.target.checked;
                                                                // Optimista en UI para que el cambio se sienta inmediato.
                                                                setReceiveBillsReportsEnabled(next);
                                                                if (next) {
                                                                    const safePeriod = receiveBillsReportsPeriod ?? "daily";
                                                                    setReceiveBillsReportsPeriod(safePeriod);
                                                                    void handleUpdateReceiveBillsReports(true, safePeriod);
                                                                } else {
                                                                    void handleUpdateReceiveBillsReports(false);
                                                                }
                                                            }}
                                                            disabled={savingReceiveBillsReports}
                                                        />
                                                        <span
                                                            className="toggle-track"
                                                            aria-hidden
                                                        />
                                                    </label>
                                                </div>

                                                <div className="billing-reports-recipients">
                                                    <div className="billing-reports-recipients-header">
                                                        <span className="billing-reports-label">¿A quién enviamos el reporte?</span>
                                                        {receiveBillsReportsEmailCatalog.length === 0 ? (
                                                            <p className="billing-reports-help">
                                                                Correo de llegada: <strong>{profile?.company.email || "—"}</strong>
                                                                {" · "}
                                                                Si añades correos, solo ellos reciben; el principal solo si lo incluyes en la lista.
                                                            </p>
                                                        ) : (
                                                            <p className="billing-reports-help">Solo reciben el reporte los destinatarios marcados; el principal solo si está en la lista.</p>
                                                        )}
                                                        {primaryReportEmail && !receiveBillsReportsEmailCatalog.includes(primaryReportEmail) && (
                                                            <div className="billing-reports-quick-actions">
                                                                <button
                                                                    type="button"
                                                                    className="btn-secondary billing-reports-quick-btn"
                                                                    onClick={addPrimaryEmailToRecipientsList}
                                                                    disabled={savingReceiveBillsReports}
                                                                    title="Añadir el correo principal a la lista"
                                                                >
                                                                    <i className="ri-mail-add-line"></i>
                                                                    Añadir correo principal a la lista
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="billing-reports-add-email">
                                                        <FilterField label="Agregar correo" htmlFor="billing-report-email" icon="ri-mail-add-line">
                                                            <FieldControl
                                                                id="billing-report-email"
                                                                type="email"
                                                                inputMode="email"
                                                                placeholder="Ej: contabilidad@empresa.com"
                                                                value={newReceiveBillsReportsEmail}
                                                                onChange={(e) => setNewReceiveBillsReportsEmail(e.target.value)}
                                                                disabled={savingReceiveBillsReports}
                                                            />
                                                        </FilterField>
                                                        <button
                                                            type="button"
                                                            className="btn-secondary billing-reports-add-btn"
                                                            onClick={() => {
                                                                const normalized = normalizeEmail(newReceiveBillsReportsEmail);
                                                                if (!normalized) return;
                                                                if (!isValidEmail(normalized)) {
                                                                    errorToast("El email ingresado no es válido");
                                                                    return;
                                                                }
                                                                if (receiveBillsReportsEmailCatalog.includes(normalized)) {
                                                                    setNewReceiveBillsReportsEmail("");
                                                                    return;
                                                                }
                                                                const nextCatalog = [...receiveBillsReportsEmailCatalog, normalized];
                                                                const nextSelected = [...receiveBillsReportsSelectedEmails, normalized];
                                                                setReceiveBillsReportsEmailCatalog(nextCatalog);
                                                                setReceiveBillsReportsSelectedEmails(nextSelected);
                                                                setNewReceiveBillsReportsEmail("");
                                                                if (receiveBillsReportsEnabled) {
                                                                    void handleUpdateReceiveBillsReports(true, receiveBillsReportsPeriod, nextSelected);
                                                                }
                                                            }}
                                                            disabled={savingReceiveBillsReports}
                                                        >
                                                            <i className="ri-add-line"></i>
                                                            Agregar
                                                        </button>
                                                    </div>

                                                    {receiveBillsReportsEmailCatalog.length > 0 ? (
                                                        <CheckCardGrid className="billing-reports-checklist">
                                                            {receiveBillsReportsEmailCatalog.map((email) => (
                                                                <CheckCard
                                                                    key={email}
                                                                    icon="ri-mail-line"
                                                                    label={email}
                                                                    checked={receiveBillsReportsSelectedEmails.includes(email)}
                                                                    disabled={savingReceiveBillsReports}
                                                                    onChange={(checked) => {
                                                                        const nextSelected = checked
                                                                            ? Array.from(new Set([...receiveBillsReportsSelectedEmails, email]))
                                                                            : receiveBillsReportsSelectedEmails.filter((x) => x !== email);
                                                                        setReceiveBillsReportsSelectedEmails(nextSelected);
                                                                        if (receiveBillsReportsEnabled) {
                                                                            void handleUpdateReceiveBillsReports(true, receiveBillsReportsPeriod, nextSelected);
                                                                        }
                                                                    }}
                                                                    trailing={
                                                                        <button
                                                                            type="button"
                                                                            className="btn-icon-prefix btn-icon-prefix-danger billing-reports-remove"
                                                                            title="Quitar email"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                const nextCatalog = receiveBillsReportsEmailCatalog.filter((x) => x !== email);
                                                                                const nextSelected = receiveBillsReportsSelectedEmails.filter((x) => x !== email);
                                                                                setReceiveBillsReportsEmailCatalog(nextCatalog);
                                                                                setReceiveBillsReportsSelectedEmails(nextSelected);
                                                                                if (receiveBillsReportsEnabled) {
                                                                                    void handleUpdateReceiveBillsReports(true, receiveBillsReportsPeriod, nextSelected);
                                                                                }
                                                                            }}
                                                                            disabled={savingReceiveBillsReports}
                                                                        >
                                                                            <i className="ri-close-line" />
                                                                        </button>
                                                                    }
                                                                />
                                                            ))}
                                                        </CheckCardGrid>
                                                    ) : (
                                                        <p className="billing-reports-empty">No hay correos adicionales configurados.</p>
                                                    )}
                                                </div>

                                                <fieldset
                                                    className="billing-reports-fieldset"
                                                    disabled={!receiveBillsReportsEnabled || savingReceiveBillsReports}
                                                >
                                                    <legend className="billing-reports-legend">Frecuencia</legend>
                                                    <CheckCardGrid className="billing-reports-radios">
                                                        <CheckCard
                                                            type="radio"
                                                            name="receive-bills-reports-period"
                                                            value="daily"
                                                            icon="ri-sun-line"
                                                            label="Diario"
                                                            checked={receiveBillsReportsPeriod === "daily"}
                                                            onChange={() => {
                                                                setReceiveBillsReportsPeriod("daily");
                                                                void handleUpdateReceiveBillsReports(true, "daily");
                                                            }}
                                                        />
                                                        <CheckCard
                                                            type="radio"
                                                            name="receive-bills-reports-period"
                                                            value="weekly"
                                                            icon="ri-calendar-week-line"
                                                            label="Semanal"
                                                            checked={receiveBillsReportsPeriod === "weekly"}
                                                            onChange={() => {
                                                                setReceiveBillsReportsPeriod("weekly");
                                                                void handleUpdateReceiveBillsReports(true, "weekly");
                                                            }}
                                                        />
                                                        <CheckCard
                                                            type="radio"
                                                            name="receive-bills-reports-period"
                                                            value="monthly"
                                                            icon="ri-calendar-line"
                                                            label="Mensual"
                                                            checked={receiveBillsReportsPeriod === "monthly"}
                                                            onChange={() => {
                                                                setReceiveBillsReportsPeriod("monthly");
                                                                void handleUpdateReceiveBillsReports(true, "monthly");
                                                            }}
                                                        />
                                                    </CheckCardGrid>
                                                    <p className="billing-reports-hint">Zona Colombia: diario 7:30am (día anterior), semanal lunes 7:30am (semana anterior lun-dom), mensual día 1 7:30am (mes anterior).</p>
                                                </fieldset>
                                            </div>
                                        </div>
                                        <div className="info-item full-width">
                                            <label>Prefijos de facturación</label>
                                            <div className="prefixes-list">
                                                {draftPrefixes.filter((p) => !p.is_nomina).length > 0 ? (
                                                    draftPrefixes.filter((p) => !p.is_nomina).map((item) => (
                                                        <div
                                                            key={item.prefix}
                                                            className={`prefix-card ${item.default ? "prefix-card-default" : ""}`}
                                                        >
                                                            <div className="prefix-card-header">
                                                                <div className="prefix-card-title">
                                                                    <span className="prefix-code">{item.prefix}</span>
                                                                    {item.default && <span className="prefix-default-badge">Por defecto</span>}
                                                                    <span className="prefix-status-badge">{item.resolution.status === "inactive" ? "Inactivo" : "Activo"}</span>
                                                                </div>
                                                                <div className="prefix-summary-inline">
                                                                    <span className="prefix-summary-chip">
                                                                        Tipo: <strong>{getTipoDocElectronicoLabel(item.resolution.tipo_doc_electronico)}</strong>
                                                                    </span>
                                                                    <span className="prefix-summary-chip">
                                                                        Factura: <strong>{getTipoFacturaLabel(item.resolution.tipo_factura)}</strong>
                                                                    </span>
                                                                    <span className="prefix-summary-chip">
                                                                        Resolución: <strong>{item.resolution.resolution || "-"}</strong>
                                                                    </span>
                                                                    <span className="prefix-summary-chip">
                                                                        Vence: <strong>{formatDateShort(item.resolution.end_date)}</strong>
                                                                    </span>
                                                                    <span className="prefix-summary-chip">
                                                                        Consecutivos:{" "}
                                                                        <strong>
                                                                            {item.resolution.init}-{item.resolution.end}
                                                                        </strong>
                                                                    </span>
                                                                </div>
                                                                <div className="prefix-card-actions">
                                                                    <button
                                                                        type="button"
                                                                        className="btn-icon-prefix"
                                                                        onClick={() => setExpandedPrefix((prev) => (prev === item.prefix ? null : item.prefix))}
                                                                        disabled={prefixActionLoading !== null || savingPrefixes}
                                                                        title={expandedPrefix === item.prefix ? "Ocultar detalle" : "Editar detalle"}
                                                                    >
                                                                        <i className={expandedPrefix === item.prefix ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}></i>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-icon-prefix"
                                                                        onClick={() => handleTogglePrefixStatus(item)}
                                                                        disabled={prefixActionLoading !== null || savingPrefixes}
                                                                        title={item.resolution.status === "inactive" ? "Activar prefijo" : "Desactivar prefijo"}
                                                                    >
                                                                        {prefixActionLoading === `status-${item.prefix}` ? (
                                                                            <i className="ri-loader-4-line ri-animate-spin"></i>
                                                                        ) : item.resolution.status === "inactive" ? (
                                                                            <i className="ri-toggle-line"></i>
                                                                        ) : (
                                                                            <i className="ri-toggle-fill"></i>
                                                                        )}
                                                                    </button>
                                                                    {!item.default && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn-icon-prefix"
                                                                            onClick={() => handleSetDefaultPrefix(item.prefix)}
                                                                            disabled={prefixActionLoading !== null || savingPrefixes}
                                                                            title="Establecer como predeterminado"
                                                                        >
                                                                            {prefixActionLoading === `default-${item.prefix}` ? <i className="ri-loader-4-line ri-animate-spin"></i> : <i className="ri-star-line"></i>}
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        className="btn-icon-prefix btn-icon-prefix-danger"
                                                                        onClick={() => openDeletePrefixModal(item.prefix)}
                                                                        disabled={prefixActionLoading !== null || savingPrefixes}
                                                                        title="Eliminar prefijo"
                                                                    >
                                                                        {prefixActionLoading === `delete-${item.prefix}` ? <i className="ri-loader-4-line ri-animate-spin"></i> : <i className="ri-delete-bin-line"></i>}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {expandedPrefix === item.prefix && (
                                                                <div className="prefix-resolution-grid led-form-grid">
                                                                    <FilterField label="Tipo de documento" htmlFor={`prefix-tipo-doc-${item.prefix}`} icon="ri-file-list-3-line">
                                                                        <FieldControl
                                                                            id={`prefix-tipo-doc-${item.prefix}`}
                                                                            as="select"
                                                                            value={item.resolution.tipo_doc_electronico ?? TipoDocElectronico.FACTURA}
                                                                            onChange={(e) => updateDraftResolutionSelect(item.prefix, "tipo_doc_electronico", e.target.value)}
                                                                            disabled
                                                                        >
                                                                            {TIPO_DOC_ELECTRONICO_OPTIONS.map((opt) => (
                                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                            ))}
                                                                        </FieldControl>
                                                                    </FilterField>
                                                                    <FilterField label="Tipo de factura" htmlFor={`prefix-tipo-factura-${item.prefix}`} icon="ri-bill-line">
                                                                        <FieldControl
                                                                            id={`prefix-tipo-factura-${item.prefix}`}
                                                                            as="select"
                                                                            value={item.resolution.tipo_factura ?? "01"}
                                                                            onChange={(e) => updateDraftResolutionSelect(item.prefix, "tipo_factura", e.target.value)}
                                                                            disabled
                                                                        >
                                                                            {getTipoFacturaOptionsForDoc(normalizeTipoDocElectronico(item.resolution.tipo_doc_electronico), item.resolution.tipo_factura).map((opt) => (
                                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                            ))}
                                                                        </FieldControl>
                                                                    </FilterField>
                                                                    <FilterField label="Fecha de inicio" htmlFor={`prefix-start-${item.prefix}`} icon="ri-calendar-line">
                                                                        <FieldControl id={`prefix-start-${item.prefix}`} type="date" value={toDateInputValue(item.resolution.start_date)} readOnly disabled />
                                                                    </FilterField>
                                                                    <FilterField label="Fecha de vencimiento" htmlFor={`prefix-end-date-${item.prefix}`} icon="ri-calendar-check-line">
                                                                        <FieldControl id={`prefix-end-date-${item.prefix}`} type="date" value={toDateInputValue(item.resolution.end_date)} readOnly disabled />
                                                                    </FilterField>
                                                                    <FilterField label="Consecutivo inicial" htmlFor={`prefix-init-${item.prefix}`} icon="ri-hashtag">
                                                                        <FieldControl
                                                                            id={`prefix-init-${item.prefix}`}
                                                                            type="number"
                                                                            min={1}
                                                                            value={item.resolution.init}
                                                                            onChange={(e) => updateDraftResolution(item.prefix, "init", parseInt(e.target.value, 10) || 1)}
                                                                            disabled
                                                                        />
                                                                    </FilterField>
                                                                    <FilterField label="Consecutivo final" htmlFor={`prefix-end-${item.prefix}`} icon="ri-hashtag">
                                                                        <FieldControl
                                                                            id={`prefix-end-${item.prefix}`}
                                                                            type="number"
                                                                            min={1}
                                                                            value={item.resolution.end}
                                                                            onChange={(e) => updateDraftResolution(item.prefix, "end", parseInt(e.target.value, 10) || 1)}
                                                                            disabled
                                                                        />
                                                                    </FilterField>
                                                                    <FilterField
                                                                        label="Consecutivos omitidos (opcional)"
                                                                        htmlFor={`prefix-locked-${item.prefix}`}
                                                                        icon="ri-forbid-line"
                                                                        className="led-form-grid__full"
                                                                        hint={<span className="prefix-field-hint">Números a omitir en el consecutivo, separados por coma.</span>}
                                                                    >
                                                                        <FieldControl
                                                                            id={`prefix-locked-${item.prefix}`}
                                                                            type="text"
                                                                            placeholder="Ej: 100, 200"
                                                                            value={lockedInputs[item.prefix] ?? ""}
                                                                            onChange={(e) =>
                                                                                setLockedInputs((prev) => ({
                                                                                    ...prev,
                                                                                    [item.prefix]: sanitizeLockedInput(e.target.value),
                                                                                }))
                                                                            }
                                                                            disabled={savingPrefixes}
                                                                        />
                                                                    </FilterField>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="no-prefixes">No hay prefijos configurados</p>
                                                )}
                                            </div>

                                            {draftPrefixes.filter((p) => !p.is_nomina).length > 0 && (
                                                <div className="prefix-save-resolutions">
                                                    <button
                                                        type="button"
                                                        className="btn-primary btn-full-width"
                                                        onClick={handleSavePrefixResolutions}
                                                        disabled={savingPrefixes || prefixActionLoading !== null}
                                                    >
                                                        {savingPrefixes ? "Guardando…" : "Guardar cambios de resolución"}
                                                    </button>
                                                </div>
                                            )}

                                            <div className="prefix-add-block">
                                                <h3 className="prefix-add-title">Añadir prefijo</h3>
                                                <p className="prefix-add-desc">
                                                    {newPrefixIsNomina
                                                        ? "Prefijo de nómina: solo necesitas el código y el consecutivo inicial."
                                                        : "Al crear un prefijo debes completar los datos del documento, la resolución y el rango de consecutivos."}
                                                </p>
                                                <CheckCardGrid className="prefix-nomina-toggle-wrap">
                                                    <CheckCard
                                                        icon="ri-file-user-line"
                                                        label="Es prefijo de nómina electrónica"
                                                        description="Solo código y consecutivo inicial"
                                                        checked={newPrefixIsNomina}
                                                        disabled={prefixActionLoading !== null}
                                                        onChange={setNewPrefixIsNomina}
                                                    />
                                                </CheckCardGrid>
                                                <div className="prefix-add-form">
                                                    <div className="prefix-add-group">
                                                        <h4 className="prefix-add-group-title">Datos básicos</h4>
                                                        <div className="prefix-add-grid led-form-grid">
                                                            <FilterField label="Prefijo" htmlFor="new-prefix-code" icon="ri-price-tag-3-line">
                                                                <FieldControl
                                                                    id="new-prefix-code"
                                                                    type="text"
                                                                    className="prefix-input"
                                                                    placeholder={newPrefixIsNomina ? "Ej. NE" : "Ej. SETP"}
                                                                    value={newPrefixInput}
                                                                    onChange={(e) => setNewPrefixInput(e.target.value.toUpperCase())}
                                                                    maxLength={newPrefixIsNomina ? 5 : 10}
                                                                    disabled={prefixActionLoading !== null}
                                                                />
                                                            </FilterField>
                                                            {!newPrefixIsNomina && (<>
                                                            <FilterField label="Tipo de documento" htmlFor="new-prefix-tipo-doc" icon="ri-file-list-3-line">
                                                                <FieldControl id="new-prefix-tipo-doc" as="select" value={newPrefixTipoDoc} onChange={(e) => setNewPrefixTipoDoc(e.target.value as TipoDocElectronicoCode)} disabled={prefixActionLoading === "add"}>
                                                                    {TIPO_DOC_ELECTRONICO_OPTIONS.map((opt) => (
                                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                    ))}
                                                                </FieldControl>
                                                            </FilterField>
                                                            <FilterField label="Tipo de factura" htmlFor="new-prefix-tipo-factura" icon="ri-bill-line">
                                                                <FieldControl id="new-prefix-tipo-factura" as="select" value={newPrefixTipoFactura} onChange={(e) => setNewPrefixTipoFactura(e.target.value as TipoDeFacturaCode)} disabled={prefixActionLoading === "add"}>
                                                                    {getTipoFacturaOptionsForDoc(newPrefixTipoDoc, newPrefixTipoFactura).map((opt) => (
                                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                    ))}
                                                                </FieldControl>
                                                            </FilterField>
                                                            <FilterField label="Número de resolución" htmlFor="new-prefix-resolution-code" icon="ri-file-shield-line">
                                                                <FieldControl
                                                                    id="new-prefix-resolution-code"
                                                                    type="text"
                                                                    placeholder="Ej: RES-2026-001"
                                                                    value={newPrefixResolutionCode}
                                                                    onChange={(e) => setNewPrefixResolutionCode(e.target.value)}
                                                                    disabled={prefixActionLoading !== null}
                                                                />
                                                            </FilterField>
                                                            </>)}
                                                        </div>
                                                    </div>
                                                    <div className="prefix-add-group">
                                                        <h4 className="prefix-add-group-title">{newPrefixIsNomina ? "Consecutivo inicial" : "Consecutivos y vigencia"}</h4>
                                                        <div className="prefix-add-grid led-form-grid">
                                                            <FilterField label="Consecutivo inicial" htmlFor="new-prefix-init" icon="ri-hashtag">
                                                                <FieldControl
                                                                    id="new-prefix-init"
                                                                    type="number"
                                                                    min={1}
                                                                    value={newPrefixInit}
                                                                    onChange={(e) => setNewPrefixInit(e.target.value)}
                                                                    disabled={prefixActionLoading === "add"}
                                                                />
                                                            </FilterField>
                                                            {!newPrefixIsNomina && (<>
                                                            <FilterField label="Consecutivo final" htmlFor="new-prefix-end" icon="ri-hashtag">
                                                                <FieldControl
                                                                    id="new-prefix-end"
                                                                    type="number"
                                                                    min={1}
                                                                    value={newPrefixEnd}
                                                                    onChange={(e) => setNewPrefixEnd(e.target.value)}
                                                                    disabled={prefixActionLoading === "add"}
                                                                />
                                                            </FilterField>
                                                            <FilterField label="Fecha de inicio" htmlFor="new-prefix-start-date" icon="ri-calendar-line">
                                                                <FieldControl
                                                                    id="new-prefix-start-date"
                                                                    type="date"
                                                                    value={newPrefixStartDate}
                                                                    onChange={(e) => setNewPrefixStartDate(e.target.value)}
                                                                    disabled={prefixActionLoading !== null}
                                                                />
                                                            </FilterField>
                                                            <FilterField label="Fecha de vencimiento" htmlFor="new-prefix-end-date" icon="ri-calendar-check-line">
                                                                <FieldControl
                                                                    id="new-prefix-end-date"
                                                                    type="date"
                                                                    value={newPrefixEndDate}
                                                                    onChange={(e) => setNewPrefixEndDate(e.target.value)}
                                                                    disabled={prefixActionLoading !== null}
                                                                />
                                                            </FilterField>
                                                            <FilterField label="Consecutivos omitidos (opcional)" htmlFor="new-prefix-locked" icon="ri-forbid-line" className="led-form-grid__full">
                                                                <FieldControl
                                                                    id="new-prefix-locked"
                                                                    type="text"
                                                                    placeholder="Ej: 100, 200"
                                                                    value={newPrefixLocked}
                                                                    onChange={(e) => setNewPrefixLocked(sanitizeLockedInput(e.target.value))}
                                                                    disabled={prefixActionLoading !== null}
                                                                />
                                                            </FilterField>
                                                            </>)}
                                                        </div>
                                                    </div>
                                                    <div className="prefix-add-submit-wrap">
                                                        <button
                                                            type="button"
                                                            className="btn-secondary prefix-add-btn"
                                                            onClick={handleAddPrefix}
                                                            disabled={
                                                                prefixActionLoading !== null ||
                                                                !newPrefixInput.trim() ||
                                                                (newPrefixIsNomina
                                                                    ? !newPrefixInit.trim()
                                                                    : !newPrefixResolutionCode.trim() || !newPrefixStartDate || !newPrefixEndDate)
                                                            }
                                                        >
                                                            {prefixActionLoading === "add" ? <i className="ri-loader-4-line ri-animate-spin"></i> : <i className="ri-add-line"></i>}
                                                            Añadir prefijo
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="info-item full-width">
                                            <label>Prefijos de nómina</label>
                                            <div className="prefixes-list">
                                                {draftPrefixes.filter((p) => p.is_nomina).length > 0 ? (
                                                    draftPrefixes.filter((p) => p.is_nomina).map((item) => (
                                                        <div
                                                            key={item.prefix}
                                                            className={`prefix-card ${item.default ? "prefix-card-default" : ""}`}
                                                        >
                                                            <div className="prefix-card-header">
                                                                <div className="prefix-card-title">
                                                                    <span className="prefix-code">{item.prefix}</span>
                                                                    {item.default && <span className="prefix-default-badge">Por defecto</span>}
                                                                    <span className="prefix-status-badge">{item.resolution.status === "inactive" ? "Inactivo" : "Activo"}</span>
                                                                </div>
                                                                <div className="prefix-summary-inline">
                                                                    <span className="prefix-summary-chip">
                                                                        Consecutivo inicial: <strong>{item.resolution.init}</strong>
                                                                    </span>
                                                                </div>
                                                                <div className="prefix-card-actions">
                                                                    {!item.default && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn-icon-prefix"
                                                                            onClick={() => handleSetDefaultPrefix(item.prefix)}
                                                                            disabled={prefixActionLoading !== null || savingPrefixes}
                                                                            title="Marcar como prefijo de nómina por defecto"
                                                                        >
                                                                            <i className="ri-star-line"></i>
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        className="btn-icon-prefix"
                                                                        onClick={() => handleTogglePrefixStatus(item)}
                                                                        disabled={prefixActionLoading !== null || savingPrefixes}
                                                                        title={item.resolution.status === "inactive" ? "Activar prefijo" : "Desactivar prefijo"}
                                                                    >
                                                                        <i className={item.resolution.status === "inactive" ? "ri-toggle-line" : "ri-toggle-fill"}></i>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-icon-prefix btn-icon-prefix-danger"
                                                                        onClick={() => openDeletePrefixModal(item.prefix)}
                                                                        disabled={prefixActionLoading !== null || savingPrefixes}
                                                                        title="Eliminar prefijo"
                                                                    >
                                                                        <i className="ri-delete-bin-line"></i>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="no-prefixes">No hay prefijos de nómina configurados</p>
                                                )}
                                            </div>

                                        </div>

                                        <div className="info-item full-width">
                                            <div className="simba-activation-block">
                                                <h3 className="prefix-add-title">Habilitación Simba</h3>
                                                <p className="prefix-add-desc">Usa el identificador de pruebas para habilitar facturación electrónica o POS. La nómina electrónica se habilita con los datos de tu compañía (no requiere identificador).</p>
                                                <div className="simba-activation-grid led-form-grid">
                                                    <FilterField label="Identificador de pruebas" htmlFor="simba-settestid" icon="ri-key-2-line">
                                                        <FieldControl
                                                            id="simba-settestid"
                                                            type="text"
                                                            placeholder="Ej: 50e0845f-a375-4419-ad0b-9b4e13197f86"
                                                            value={simbaSetTestId}
                                                            onChange={(e) => setSimbaSetTestId(e.target.value)}
                                                            disabled={simbaActionLoading !== null}
                                                        />
                                                    </FilterField>
                                                    {simbaNominaToken ? (
                                                        <FilterField label="Token Simba (nómina)" htmlFor="simba-nomina-token" icon="ri-shield-keyhole-line" className="led-form-grid__full">
                                                            <FieldControl id="simba-nomina-token" type="text" value={simbaNominaToken} readOnly />
                                                        </FilterField>
                                                    ) : null}
                                                    <div className="simba-activation-actions">
                                                        <button
                                                            type="button"
                                                            className="btn-secondary prefix-add-btn"
                                                            onClick={() => handleSimbaActivation("fe")}
                                                            disabled={!simbaSetTestId.trim() || simbaActionLoading !== null}
                                                        >
                                                            {simbaActionLoading === "fe" ? <i className="ri-loader-4-line ri-animate-spin"></i> : <i className="ri-shield-check-line"></i>}
                                                            Habilitar FE
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-secondary prefix-add-btn"
                                                            onClick={() => handleSimbaActivation("pos")}
                                                            disabled={!simbaSetTestId.trim() || simbaActionLoading !== null}
                                                        >
                                                            {simbaActionLoading === "pos" ? <i className="ri-loader-4-line ri-animate-spin"></i> : <i className="ri-store-2-line"></i>}
                                                            Habilitar POS
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-secondary prefix-add-btn"
                                                            onClick={() => handleSimbaActivation("ne")}
                                                            disabled={!simbaNominaPrefijo.trim() || !simbaNominaToken.trim() || simbaActionLoading !== null}
                                                        >
                                                            {simbaActionLoading === "ne" ? <i className="ri-loader-4-line ri-animate-spin"></i> : <i className="ri-wallet-3-line"></i>}
                                                            Habilitar Nómina
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="simba-activation-block">
                                                <h3 className="prefix-add-title">Rangos de numeración (Simba)</h3>
                                                <p className="prefix-add-desc">Consulta en Simba los rangos habilitados para tu NIT</p>
                                                <div className="simba-numbering-actions">
                                                    <button
                                                        type="button"
                                                        className="btn-secondary prefix-add-btn"
                                                        onClick={() => void handleFetchNumberingRange()}
                                                        disabled={numberingRangeLoading || simbaActionLoading !== null}
                                                    >
                                                        {numberingRangeLoading ? <i className="ri-loader-4-line ri-animate-spin"></i> : <i className="ri-file-list-3-line"></i>}
                                                        Consultar rangos
                                                    </button>
                                                </div>
                                                {numberingRangePayload !== null && (
                                                    <pre
                                                        className="simba-numbering-json"
                                                        tabIndex={0}
                                                    >
                                                        {JSON.stringify(numberingRangePayload, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeSection === "documents" && (
                            <div className="profile-card">
                                <h2>Documentos</h2>
                                {!profile?.companyDocuments ? (
                                    <p className="acc-sub" style={{ marginTop: 8 }}>
                                        Esta empresa no tiene documentos de cuenta cargados.
                                    </p>
                                ) : (
                                <div className="info-grid">
                                    <div className="info-item">
                                        <label>RUT</label>
                                        <button
                                            className="document-link"
                                            onClick={() => (selectedDocument === profile?.companyDocuments?.rut?.url ? setSelectedDocument(null) : setSelectedDocument(profile?.companyDocuments?.rut?.url ?? null))}
                                        >
                                            <i className="ri-file-pdf-line"></i>
                                            Click para ver
                                        </button>
                                    </div>
                                    <div className="info-item">
                                        <label>Cámara de Comercio</label>
                                        <button
                                            className="document-link"
                                            onClick={() => (selectedDocument === profile?.companyDocuments?.camara_comercio?.url ? setSelectedDocument(null) : setSelectedDocument(profile?.companyDocuments?.camara_comercio?.url ?? null))}
                                        >
                                            <i className="ri-file-pdf-line"></i>
                                            Click para ver
                                        </button>
                                    </div>
                                    <div className="info-item">
                                        <label>Cédula Frontal</label>
                                        <button
                                            onClick={() => (selectedDocument === profile?.companyDocuments?.cedula_front?.url ? setSelectedDocument(null) : setSelectedDocument(profile?.companyDocuments?.cedula_front?.url ?? null))}
                                            className="document-link"
                                        >
                                            <i className="ri-image-line"></i>
                                            Click para ver
                                        </button>
                                    </div>
                                    <div className="info-item">
                                        <label>Cédula Posterior</label>
                                        <button
                                            onClick={() => (selectedDocument === profile?.companyDocuments?.cedula_back?.url ? setSelectedDocument(null) : setSelectedDocument(profile?.companyDocuments?.cedula_back?.url ?? null))}
                                            className="document-link"
                                        >
                                            <i className="ri-image-line"></i>
                                            Click para ver
                                        </button>
                                    </div>
                                    <div className="info-item">
                                        <label>Contrato Mandato</label>
                                        <button
                                            onClick={() => (selectedDocument === profile?.companyDocuments?.contrato_mandato ? setSelectedDocument(null) : setSelectedDocument(profile?.companyDocuments?.contrato_mandato ?? null))}
                                            className="document-link"
                                        >
                                            <i className="ri-file-pdf-line"></i>
                                            Click para ver
                                        </button>
                                    </div>
                                </div>
                                )}
                                {selectedDocument && (
                                    <iframe
                                        src={selectedDocument}
                                        frameBorder="0"
                                        className="selected-document-iframe"
                                    >
                                        <p>No se puede mostrar el documento</p>
                                    </iframe>
                                )}
                            </div>
                        )}

                        {activeSection === "events" && (
                            <div className="profile-card">
                                <div className="event-console">
                                    <div className="event-console-header">
                                        <div className="event-console-title">
                                            <span
                                                className="event-console-icon"
                                                aria-hidden
                                            >
                                                ›
                                            </span>
                                            <h1>Consola de eventos</h1>
                                            <span className="event-console-subtitle">Registro de actividad: facturas, clientes, productos</span>
                                        </div>
                                        <div className="event-console-actions">
                                            <button
                                                type="button"
                                                className="event-console-btn event-console-btn-clear"
                                                onClick={() => setIsClearLogsModalOpen(true)}
                                                disabled={logsLoading || isLogsPageFetching || totalLogs === 0}
                                                title="Elimina todos los registros. Esta acción no se puede deshacer."
                                            >
                                                <i
                                                    className="ri-delete-bin-line"
                                                    aria-hidden
                                                ></i>
                                                Limpiar consola
                                            </button>
                                        </div>
                                    </div>

                                    {logsLoading ? (
                                        <div className="event-console-body event-console-loading">
                                            <span className="event-console-prompt">$</span>
                                            <span> Cargando eventos...</span>
                                        </div>
                                    ) : logs.length === 0 ? (
                                        <div className="event-console-body event-console-empty">
                                            <div className="event-console-line">
                                                <span className="event-console-prompt">$</span>
                                                <span className="event-console-msg"> No hay eventos registrados.</span>
                                            </div>
                                            <div className="event-console-line event-console-line-muted">
                                                <span className="event-console-prompt">&gt;</span>
                                                <span> Al crear facturas, clientes o productos aparecerán aquí.</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="event-console-body">
                                                <div className="event-console-toolbar">
                                                    <span className="event-console-meta">
                                                        Página {logsPage} de {logsTotalPages}
                                                        {totalLogs > 0 && ` · ${totalLogs} eventos`}
                                                        {isLogsPageFetching ? " · Actualizando..." : ""}
                                                    </span>
                                                </div>
                                                <div className="event-console-output">
                                                    {logs.map((log, index) => (
                                                        <div
                                                            key={log._id}
                                                            className="event-console-line"
                                                            data-index={index + 1}
                                                        >
                                                            <span
                                                                className="event-console-timestamp"
                                                                title={formatConsoleDate(log.date)}
                                                            >
                                                                [{formatConsoleTime(log.date)}]
                                                            </span>
                                                            <span className="event-console-msg">{log.description}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {logsTotalPages > 1 && (
                                                <div className="event-console-pagination">
                                                    <button
                                                        type="button"
                                                        className="event-console-btn"
                                                        onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                                                        disabled={logsPage === 1 || logsLoading || isLogsPageFetching}
                                                    >
                                                        ‹ Anterior
                                                    </button>
                                                    <span className="event-console-pagination-info">
                                                        {logsPage} / {logsTotalPages}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="event-console-btn"
                                                        onClick={() => setLogsPage((p) => Math.min(logsTotalPages, p + 1))}
                                                        disabled={logsPage === logsTotalPages || logsLoading || isLogsPageFetching}
                                                    >
                                                        Siguiente ›
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <UpdateLogoModal
                isOpen={isLogoModalOpen}
                onClose={() => setIsLogoModalOpen(false)}
                currentLogoUrl={profile?.company.logo?.url ?? ""}
                onSuccess={handleLogoModalSuccess}
            />

            <ConfirmModal
                isOpen={deletePrefixModal.open}
                onClose={closeDeletePrefixModal}
                onConfirm={confirmDeletePrefix}
                title="Eliminar prefijo"
                message={`¿Seguro que deseas eliminar el prefijo${deletePrefixModal.prefix ? ` "${deletePrefixModal.prefix}"` : ""}? Esta acción no se puede deshacer.`}
                confirmText="Sí, eliminar"
                cancelText="Cancelar"
                type="danger"
                loading={typeof prefixActionLoading === "string" && prefixActionLoading.startsWith("delete-")}
            />

            <ConfirmModal
                isOpen={isClearLogsModalOpen}
                onClose={() => !isClearingLogs && setIsClearLogsModalOpen(false)}
                onConfirm={handleClearLogs}
                title="Limpiar consola"
                message="¿Eliminar todos los eventos? Esta acción no se puede deshacer."
                confirmText="Limpiar todo"
                cancelText="Cancelar"
                type="danger"
                loading={isClearingLogs}
            />
        </main>
    );
};

export default ProfilePage;
