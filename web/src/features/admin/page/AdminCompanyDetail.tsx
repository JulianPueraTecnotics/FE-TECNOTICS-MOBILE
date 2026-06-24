import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./Admin.css";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { ConfirmModal } from "../../../components/modals";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { PATHS } from "../../../router/paths.contants";
import PaginatedTable from "../components/PaginatedTable";
import {
    adminAddPrefix,
    adminCreateSubscription,
    adminCreateSubUser,
    adminDeleteClient,
    adminDeleteItem,
    adminDeleteSubUser,
    adminGetCompany,
    adminGetCompanySubscription,
    adminListCompanyClients,
    adminListCompanyInvoices,
    adminListCompanyItems,
    adminListCompanySubUsers,
    adminListPlans,
    adminRemovePrefix,
    adminResetCompanyPassword,
    adminResetSubUserPassword,
    adminSetCompanyActive,
    adminSetPrefixDefault,
    adminSetPrefixStatus,
    adminUpdateClient,
    adminUpdateCompany,
    adminUpdateItem,
    adminUpdatePrefix,
    adminUpdateSubscription,
    adminUpdateSubUser,
    type AdminClient,
    type AdminCompanyDetail as CompanyDetail,
    type AdminCreateSubUserBody,
    type AdminInvoice,
    type AdminItem,
    type AdminPlan,
    type AdminPrefixResolutionInput,
    type AdminSubUser,
    type AdminUpdateCompanyBody,
    type AdminUpdateSubscriptionBody,
} from "../services/admin_companies.service";
import type { CompanySubscriptionResponse } from "../../profile/page/services/get_subscription";
import type { CompanyInterface, CompanyPrefix } from "../../profile/page/services/get_profile";

const TIPO_DOC_OPTIONS = [
    { value: "01", label: "Factura de venta" },
    { value: "02", label: "Nota débito" },
    { value: "03", label: "Nota crédito" },
    { value: "11", label: "Documento soporte" },
];
const TIPO_FACTURA_OPTIONS = [
    { value: "01", label: "Factura de venta" },
    { value: "02", label: "Exportación" },
    { value: "03", label: "Contingencia facturador" },
    { value: "04", label: "Contingencia DIAN" },
    { value: "05", label: "Documento soporte" },
    { value: "20", label: "Nota crédito" },
    { value: "92", label: "Nota débito" },
    { value: "020", label: "Nota crédito sin referencia" },
];

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
    APPROVED: { label: "Aprobada", cls: "admin-badge-active" },
    SENT: { label: "Enviada", cls: "admin-badge-active" },
    PENDING: { label: "Pendiente", cls: "admin-badge-warning" },
    REJECTED: { label: "Rechazada", cls: "admin-badge-inactive" },
};

const formatShortDate = (value?: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
    active: "Activa",
    inactive: "Inactiva",
    expired: "Vencida",
};

const formatCurrencyCOP = (value?: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value ?? 0);

const formatDate = (value?: string | Date) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
};

const InfoItem: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="admin-info-item">
        <label>{label}</label>
        <span>{value ?? "—"}</span>
    </div>
);

type ResetTarget = { kind: "company" | "subuser"; id: string; label: string };

/** Modal para que el superadmin fije una nueva contraseña a una empresa o subusuario. */
const ResetPasswordModal: React.FC<{ target: ResetTarget; onClose: () => void; onSubmit: (password: string) => Promise<void> }> = ({ target, onClose, onSubmit }) => {
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    useBodyScrollLock(true);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            errorToast("La contraseña debe tener al menos 8 caracteres.");
            return;
        }
        setLoading(true);
        try {
            await onSubmit(password);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
                <h3 className="confirm-title">Restablecer contraseña</h3>
                <p className="confirm-message">
                    Define una nueva contraseña para <strong>{target.label}</strong>. Se cerrará su sesión activa.
                </p>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-field">
                        <label htmlFor="admin-reset-pwd">Nueva contraseña</label>
                        <input
                            id="admin-reset-pwd"
                            type={show ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 8 caracteres"
                            autoComplete="new-password"
                        />
                        <button type="button" className="admin-btn-secondary" onClick={() => setShow((v) => !v)} style={{ alignSelf: "flex-start" }}>
                            {show ? "Ocultar" : "Mostrar"} contraseña
                        </button>
                    </div>
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : "Restablecer"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/** Modal de edición de los datos de contacto/banco de la empresa. */
const EditCompanyModal: React.FC<{ company: CompanyInterface; onClose: () => void; onSaved: (body: AdminUpdateCompanyBody) => Promise<void> }> = ({ company, onClose, onSaved }) => {
    const [form, setForm] = useState({
        email: company.email ?? "",
        phone: company.phone ?? "",
        website: company.website ?? "",
        address: company.address?.value ?? "",
        bank_name: company.bank_account?.name ?? "",
        bank_account_number: company.bank_account?.account_number ?? "",
        bank_account_type: String(company.bank_account?.account_type ?? ""),
        observations: company.observations ?? "",
    });
    const [loading, setLoading] = useState(false);
    useBodyScrollLock(true);

    const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            errorToast("El correo no tiene un formato válido.");
            return;
        }
        if (form.bank_account_number && (form.bank_name.trim() === "" || !form.bank_account_type)) {
            errorToast("Para una cuenta bancaria indica también el banco y el tipo de cuenta.");
            return;
        }
        setLoading(true);
        try {
            const body: AdminUpdateCompanyBody = {
                email: form.email.trim(),
                phone: form.phone.trim(),
                website: form.website.trim(),
                address: { value: form.address.trim() },
                bank_account: {
                    name: form.bank_name.trim(),
                    account_number: form.bank_account_number.trim(),
                    ...(form.bank_account_type === "ahorro" || form.bank_account_type === "corriente" ? { account_type: form.bank_account_type } : {}),
                },
                observations: form.observations,
            };
            await onSaved(body);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <h3 className="confirm-title">Editar empresa</h3>
                <p className="confirm-message">{company.razon_social}</p>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-form-grid">
                        <div className="admin-field">
                            <label htmlFor="ec-email">Correo</label>
                            <input id="ec-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="ec-phone">Teléfono</label>
                            <input
                                id="ec-phone"
                                type="text"
                                inputMode="numeric"
                                value={form.phone}
                                onChange={(e) => setField("phone", e.target.value.replace(/[^\d]/g, ""))}
                                placeholder="Solo números"
                            />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="ec-website">Sitio web</label>
                            <input id="ec-website" type="text" value={form.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://…" />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="ec-address">Dirección</label>
                            <input id="ec-address" type="text" value={form.address} onChange={(e) => setField("address", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="ec-bank-name">Banco</label>
                            <input id="ec-bank-name" type="text" value={form.bank_name} onChange={(e) => setField("bank_name", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="ec-bank-number">N° de cuenta</label>
                            <input
                                id="ec-bank-number"
                                type="text"
                                inputMode="numeric"
                                value={form.bank_account_number}
                                onChange={(e) => setField("bank_account_number", e.target.value.replace(/[^\d]/g, ""))}
                                placeholder="Solo números"
                            />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="ec-bank-type">Tipo de cuenta</label>
                            <select
                                id="ec-bank-type"
                                value={form.bank_account_type}
                                onChange={(e) => setField("bank_account_type", e.target.value)}
                                style={{ padding: "0.6rem 0.75rem", border: "1px solid var(--border-light)", borderRadius: 8, background: "var(--card-bg)", color: "var(--primary-text, #1f2937)" }}
                            >
                                <option value="">—</option>
                                <option value="ahorro">Ahorro</option>
                                <option value="corriente">Corriente</option>
                            </select>
                        </div>
                    </div>
                    <div className="admin-field">
                        <label htmlFor="ec-observations">Observaciones</label>
                        <input id="ec-observations" type="text" value={form.observations} onChange={(e) => setField("observations", e.target.value)} />
                    </div>
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : "Guardar cambios"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/** Modal para agregar o editar un prefijo con su resolución DIAN. */
const PrefixModal: React.FC<{ editPrefix?: CompanyPrefix | null; onClose: () => void; onSubmit: (prefix: string, resolution: AdminPrefixResolutionInput) => Promise<void> }> = ({ editPrefix, onClose, onSubmit }) => {
    const isEdit = Boolean(editPrefix);
    const r = editPrefix?.resolution;
    const [form, setForm] = useState({
        prefix: editPrefix?.prefix ?? "",
        resolution: r?.resolution ?? "",
        init: r?.init != null ? String(r.init) : "1",
        end: r?.end != null ? String(r.end) : "",
        start_date: toDateInput(r?.start_date),
        end_date: toDateInput(r?.end_date),
        tipo_doc_electronico: r?.tipo_doc_electronico ?? "01",
        tipo_factura: r?.tipo_factura ?? "01",
    });
    const [loading, setLoading] = useState(false);
    useBodyScrollLock(true);

    const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const init = Number(form.init);
        const end = Number(form.end);
        if (!form.prefix.trim()) return errorToast("El prefijo es obligatorio.");
        if (!form.resolution.trim()) return errorToast("El número de resolución es obligatorio.");
        if (!Number.isFinite(init) || !Number.isFinite(end) || init <= 0 || end <= 0) return errorToast("Rango (init/end) inválido.");
        if (init > end) return errorToast("El inicio no puede ser mayor que el fin.");
        if (!form.start_date || !form.end_date) return errorToast("Las fechas de la resolución son obligatorias.");

        setLoading(true);
        try {
            await onSubmit(form.prefix.trim().toUpperCase(), {
                init,
                end,
                resolution: form.resolution.trim(),
                start_date: form.start_date,
                end_date: form.end_date,
                tipo_doc_electronico: form.tipo_doc_electronico,
                tipo_factura: form.tipo_factura,
            });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <h3 className="confirm-title">{isEdit ? "Editar prefijo" : "Agregar prefijo"}</h3>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-form-grid">
                        <div className="admin-field">
                            <label htmlFor="pf-prefix">Prefijo</label>
                            <input id="pf-prefix" type="text" value={form.prefix} onChange={(e) => setField("prefix", e.target.value.toUpperCase())} placeholder="Ej: FE" disabled={isEdit} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pf-res">N° de resolución</label>
                            <input id="pf-res" type="text" value={form.resolution} onChange={(e) => setField("resolution", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pf-init">Desde (init)</label>
                            <input id="pf-init" type="text" inputMode="numeric" value={form.init} onChange={(e) => setField("init", e.target.value.replace(/[^\d]/g, ""))} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pf-end">Hasta (end)</label>
                            <input id="pf-end" type="text" inputMode="numeric" value={form.end} onChange={(e) => setField("end", e.target.value.replace(/[^\d]/g, ""))} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pf-start">Vigencia desde</label>
                            <input id="pf-start" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pf-enddate">Vigencia hasta {isEdit ? "(no editable)" : ""}</label>
                            <input id="pf-enddate" type="date" value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} disabled={isEdit} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pf-tipodoc">Tipo de documento {isEdit ? "(no editable)" : ""}</label>
                            <select id="pf-tipodoc" className="admin-select" value={form.tipo_doc_electronico} onChange={(e) => setField("tipo_doc_electronico", e.target.value)} disabled={isEdit}>
                                {TIPO_DOC_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pf-tipofac">Tipo de factura</label>
                            <select id="pf-tipofac" className="admin-select" value={form.tipo_factura} onChange={(e) => setField("tipo_factura", e.target.value)}>
                                {TIPO_FACTURA_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {isEdit ? <p className="admin-prefix-meta">La vigencia (fin) y el tipo de documento no se pueden cambiar una vez creado el prefijo.</p> : null}
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : isEdit ? "Guardar prefijo" : "Agregar prefijo"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/** Modal para editar un cliente. */
const ClientModal: React.FC<{ companyId: string; client: AdminClient; onClose: () => void; onSaved: () => Promise<void> }> = ({ companyId, client, onClose, onSaved }) => {
    const [form, setForm] = useState({
        name: client.name ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        doc_type: client.doc_type ?? "Cc",
        doc_number: client.doc_number ?? "",
    });
    const [loading, setLoading] = useState(false);
    useBodyScrollLock(true);
    const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return errorToast("El nombre es obligatorio.");
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return errorToast("Correo inválido.");
        setLoading(true);
        try {
            await adminUpdateClient(companyId, client._id, {
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                doc_type: form.doc_type,
                doc_number: form.doc_number.trim(),
            });
            successToast("Cliente actualizado");
            await onSaved();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al actualizar el cliente");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
                <h3 className="confirm-title">Editar cliente</h3>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-form-grid">
                        <div className="admin-field">
                            <label htmlFor="cl-name">Nombre</label>
                            <input id="cl-name" type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="cl-email">Correo</label>
                            <input id="cl-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="cl-phone">Teléfono</label>
                            <input id="cl-phone" type="text" inputMode="numeric" value={form.phone} onChange={(e) => setField("phone", e.target.value.replace(/[^\d]/g, ""))} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="cl-doctype">Tipo de documento</label>
                            <select id="cl-doctype" className="admin-select" value={form.doc_type} onChange={(e) => setField("doc_type", e.target.value)}>
                                {DOC_TYPE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="admin-field">
                            <label htmlFor="cl-docnum">N° de documento</label>
                            <input id="cl-docnum" type="text" value={form.doc_number} onChange={(e) => setField("doc_number", e.target.value)} />
                        </div>
                    </div>
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : "Guardar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/** Modal para editar un item. */
const ItemModal: React.FC<{ companyId: string; item: AdminItem; onClose: () => void; onSaved: () => Promise<void> }> = ({ companyId, item, onClose, onSaved }) => {
    const [form, setForm] = useState({
        name: item.name ?? "",
        code: item.code ?? "",
        price: item.price != null ? String(item.price) : "",
        description: item.description ?? "",
        kind: (item.kind as "product" | "service") ?? "product",
    });
    const [loading, setLoading] = useState(false);
    useBodyScrollLock(true);
    const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return errorToast("El nombre es obligatorio.");
        const price = Number(form.price);
        if (!Number.isFinite(price) || price < 0) return errorToast("Precio inválido.");
        setLoading(true);
        try {
            await adminUpdateItem(companyId, item._id, {
                name: form.name.trim(),
                code: form.code.trim(),
                price,
                description: form.description.trim(),
                kind: form.kind,
            });
            successToast("Item actualizado");
            await onSaved();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al actualizar el item");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
                <h3 className="confirm-title">Editar item</h3>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-form-grid">
                        <div className="admin-field">
                            <label htmlFor="it-name">Nombre</label>
                            <input id="it-name" type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="it-code">Código</label>
                            <input id="it-code" type="text" value={form.code} onChange={(e) => setField("code", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="it-price">Precio (COP)</label>
                            <input id="it-price" type="text" inputMode="numeric" value={form.price} onChange={(e) => setField("price", e.target.value.replace(/[^\d]/g, ""))} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="it-kind">Tipo</label>
                            <select id="it-kind" className="admin-select" value={form.kind} onChange={(e) => setField("kind", e.target.value)}>
                                <option value="product">Producto</option>
                                <option value="service">Servicio</option>
                            </select>
                        </div>
                    </div>
                    <div className="admin-field">
                        <label htmlFor="it-desc">Descripción</label>
                        <input id="it-desc" type="text" value={form.description} onChange={(e) => setField("description", e.target.value)} />
                    </div>
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : "Guardar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const toDateInput = (value?: string | Date) => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const DOC_TYPE_OPTIONS = [
    { value: "Cc", label: "Cédula de ciudadanía" },
    { value: "Ce", label: "Cédula de extranjería" },
    { value: "Pasaporte", label: "Pasaporte" },
    { value: "Ti", label: "Tarjeta de identidad" },
    { value: "Nit", label: "NIT" },
];

/** Modal para editar (o crear) la suscripción de la empresa. */
const SubscriptionModal: React.FC<{ companyId: string; subscription: CompanySubscriptionResponse | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ companyId, subscription, onClose, onSaved }) => {
    const sub = subscription?.suscription;
    const isEdit = Boolean(sub);
    const [plans, setPlans] = useState<AdminPlan[]>([]);
    const [form, setForm] = useState({
        plan_id: String(sub?.plan_id ?? ""),
        start_date: toDateInput(sub?.start_date),
        end_date: toDateInput(sub?.end_date),
        base_documents: sub?.base_documents != null ? String(sub.base_documents) : "",
        extra_documents: sub?.extra_documents != null ? String(sub.extra_documents) : "",
        total_price: sub?.total_price != null ? String(sub.total_price) : "",
        status: (sub?.status ?? "active") as "active" | "inactive" | "expired",
    });
    const [loading, setLoading] = useState(false);
    useBodyScrollLock(true);

    useEffect(() => {
        adminListPlans()
            .then(setPlans)
            .catch(() => undefined);
    }, []);

    const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (!isEdit) {
                if (!form.plan_id) {
                    errorToast("Selecciona un plan para crear la suscripción.");
                    setLoading(false);
                    return;
                }
                await adminCreateSubscription(companyId, form.plan_id);
            } else {
                const body: AdminUpdateSubscriptionBody = {
                    plan_id: form.plan_id || undefined,
                    start_date: form.start_date || undefined,
                    end_date: form.end_date || undefined,
                    base_documents: form.base_documents !== "" ? Number(form.base_documents) : undefined,
                    extra_documents: form.extra_documents !== "" ? Number(form.extra_documents) : undefined,
                    total_price: form.total_price !== "" ? Number(form.total_price) : undefined,
                    status: form.status,
                };
                await adminUpdateSubscription(companyId, body);
            }
            successToast(isEdit ? "Suscripción actualizada" : "Suscripción creada");
            await onSaved();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al guardar la suscripción");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
                <h3 className="confirm-title">{isEdit ? "Editar suscripción" : "Crear suscripción"}</h3>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-field">
                        <label htmlFor="sub-plan">Plan</label>
                        <select id="sub-plan" className="admin-select" value={form.plan_id} onChange={(e) => setField("plan_id", e.target.value)}>
                            <option value="">{isEdit ? "(mantener)" : "Selecciona un plan…"}</option>
                            {plans.map((p) => (
                                <option key={p._id} value={p._id}>
                                    {p.title} — {p.include_documents} docs
                                </option>
                            ))}
                        </select>
                    </div>

                    {isEdit ? (
                        <>
                            <div className="admin-form-grid">
                                <div className="admin-field">
                                    <label htmlFor="sub-start">Inicio</label>
                                    <input id="sub-start" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
                                </div>
                                <div className="admin-field">
                                    <label htmlFor="sub-end">Vencimiento</label>
                                    <input id="sub-end" type="date" value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} />
                                </div>
                                <div className="admin-field">
                                    <label htmlFor="sub-base">Documentos base</label>
                                    <input id="sub-base" type="text" inputMode="numeric" value={form.base_documents} onChange={(e) => setField("base_documents", e.target.value.replace(/[^\d]/g, ""))} />
                                </div>
                                <div className="admin-field">
                                    <label htmlFor="sub-extra">Documentos extra</label>
                                    <input id="sub-extra" type="text" inputMode="numeric" value={form.extra_documents} onChange={(e) => setField("extra_documents", e.target.value.replace(/[^\d]/g, ""))} />
                                </div>
                                <div className="admin-field">
                                    <label htmlFor="sub-price">Valor (COP)</label>
                                    <input id="sub-price" type="text" inputMode="numeric" value={form.total_price} onChange={(e) => setField("total_price", e.target.value.replace(/[^\d]/g, ""))} />
                                </div>
                                <div className="admin-field">
                                    <label htmlFor="sub-status">Estado</label>
                                    <select id="sub-status" className="admin-select" value={form.status} onChange={(e) => setField("status", e.target.value)}>
                                        <option value="active">Activa</option>
                                        <option value="inactive">Inactiva</option>
                                        <option value="expired">Vencida</option>
                                    </select>
                                </div>
                            </div>
                            <p className="admin-prefix-meta">Los documentos totales se recalculan como base + extra.</p>
                        </>
                    ) : (
                        <p className="confirm-message">La suscripción se creará a partir del plan seleccionado (fechas y documentos según el plan).</p>
                    )}

                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/** Modal para crear o editar un subusuario. */
const SubUserModal: React.FC<{ companyId: string; subUser: AdminSubUser | null; onClose: () => void; onSaved: () => Promise<void> }> = ({ companyId, subUser, onClose, onSaved }) => {
    const isEdit = Boolean(subUser);
    const [form, setForm] = useState({
        name: subUser?.name ?? "",
        last_name: subUser?.last_name ?? "",
        email: subUser?.email ?? "",
        phone: subUser?.phone ?? "",
        doc_type: "Cc",
        doc_number: "",
    });
    const [loading, setLoading] = useState(false);
    useBodyScrollLock(true);

    const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.last_name.trim()) return errorToast("Nombre y apellido son obligatorios.");
        if (!isEdit) {
            if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return errorToast("Correo inválido.");
            if (!form.phone.trim() || !form.doc_number.trim()) return errorToast("Teléfono y número de documento son obligatorios.");
        }
        setLoading(true);
        try {
            if (isEdit && subUser) {
                await adminUpdateSubUser(subUser._id, { name: form.name.trim(), last_name: form.last_name.trim(), phone: form.phone.trim() });
            } else {
                const body: AdminCreateSubUserBody = {
                    name: form.name.trim(),
                    last_name: form.last_name.trim(),
                    email: form.email.trim(),
                    phone: form.phone.trim(),
                    doc_type: form.doc_type,
                    doc_number: form.doc_number.trim(),
                };
                await adminCreateSubUser(companyId, body);
            }
            successToast(isEdit ? "Subusuario actualizado" : "Subusuario creado (se le envió su contraseña por correo)");
            await onSaved();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al guardar el subusuario");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
                <h3 className="confirm-title">{isEdit ? "Editar subusuario" : "Nuevo subusuario"}</h3>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-form-grid">
                        <div className="admin-field">
                            <label htmlFor="su-name">Nombre</label>
                            <input id="su-name" type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="su-lastname">Apellido</label>
                            <input id="su-lastname" type="text" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="su-phone">Teléfono</label>
                            <input id="su-phone" type="text" inputMode="numeric" value={form.phone} onChange={(e) => setField("phone", e.target.value.replace(/[^\d]/g, ""))} />
                        </div>
                        {!isEdit && (
                            <>
                                <div className="admin-field">
                                    <label htmlFor="su-email">Correo</label>
                                    <input id="su-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                                </div>
                                <div className="admin-field">
                                    <label htmlFor="su-doctype">Tipo de documento</label>
                                    <select id="su-doctype" className="admin-select" value={form.doc_type} onChange={(e) => setField("doc_type", e.target.value)}>
                                        {DOC_TYPE_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="admin-field">
                                    <label htmlFor="su-docnum">N° de documento</label>
                                    <input id="su-docnum" type="text" value={form.doc_number} onChange={(e) => setField("doc_number", e.target.value)} />
                                </div>
                            </>
                        )}
                    </div>
                    {isEdit ? <p className="admin-prefix-meta">El correo y documento no se editan aquí. Usa "Restablecer contraseña" para cambiar el acceso.</p> : null}
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : isEdit ? "Guardar" : "Crear subusuario"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminCompanyDetail: React.FC = () => {
    const { companyId } = useParams<{ companyId: string }>();
    const navigate = useNavigate();

    const [detail, setDetail] = useState<CompanyDetail | null>(null);
    const [subscription, setSubscription] = useState<CompanySubscriptionResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const [confirmToggle, setConfirmToggle] = useState(false);
    const [toggleLoading, setToggleLoading] = useState(false);
    const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
    const [editing, setEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<"prefijos" | "facturas" | "clientes" | "items" | "subusuarios">("prefijos");
    const [addingPrefix, setAddingPrefix] = useState(false);
    const [editingPrefix, setEditingPrefix] = useState<CompanyPrefix | null>(null);
    const [prefixToDelete, setPrefixToDelete] = useState<string | null>(null);
    const [prefixActionLoading, setPrefixActionLoading] = useState(false);
    const [clientEdit, setClientEdit] = useState<AdminClient | null>(null);
    const [itemEdit, setItemEdit] = useState<AdminItem | null>(null);
    const [editingSubscription, setEditingSubscription] = useState(false);
    const [subUserModal, setSubUserModal] = useState<AdminSubUser | "new" | null>(null);
    const [clientsReload, setClientsReload] = useState(0);
    const [itemsReload, setItemsReload] = useState(0);
    const [subUsersReload, setSubUsersReload] = useState(0);
    const [confirmDelete, setConfirmDelete] = useState<{ kind: "client" | "item" | "subuser"; id: string; label: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        if (!companyId) return;
        let active = true;
        setLoading(true);

        (async () => {
            try {
                const [detailRes, subRes] = await Promise.allSettled([adminGetCompany(companyId), adminGetCompanySubscription(companyId)]);
                if (!active) return;

                if (detailRes.status === "fulfilled") setDetail(detailRes.value);
                else errorToast(detailRes.reason instanceof Error ? detailRes.reason.message : "Error al obtener la empresa");

                if (subRes.status === "fulfilled") setSubscription(subRes.value);
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [companyId]);

    // Fetchers estables por pestaña (se cargan bajo demanda con paginación).
    const fetchInvoices = useCallback((page: number) => adminListCompanyInvoices(companyId ?? "", page), [companyId]);
    const fetchClients = useCallback((page: number) => adminListCompanyClients(companyId ?? "", page), [companyId]);
    const fetchItems = useCallback((page: number) => adminListCompanyItems(companyId ?? "", page), [companyId]);
    const fetchSubUsers = useCallback(
        (page: number) => adminListCompanySubUsers(companyId ?? "", { page }).then((items) => ({ items, total: items.length, pages: 1 })),
        [companyId],
    );

    const company = detail?.company;
    const sub = subscription?.suscription;

    const handleToggleActive = async () => {
        if (!company || !companyId) return;
        setToggleLoading(true);
        try {
            const res = await adminSetCompanyActive(companyId, !company.active);
            setDetail((prev) => (prev ? { ...prev, company: { ...prev.company, active: res.active } } : prev));
            successToast(res.active ? "Empresa activada" : "Empresa desactivada");
            setConfirmToggle(false);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al actualizar el estado");
        } finally {
            setToggleLoading(false);
        }
    };

    const handleEditSave = async (body: AdminUpdateCompanyBody) => {
        if (!companyId) return;
        try {
            const message = await adminUpdateCompany(companyId, body);
            // Refrescar con los datos guardados.
            setDetail((prev) =>
                prev
                    ? {
                          ...prev,
                          company: {
                              ...prev.company,
                              email: body.email ?? prev.company.email,
                              phone: body.phone ?? prev.company.phone,
                              website: body.website ?? prev.company.website,
                              address: { ...prev.company.address, value: body.address?.value ?? prev.company.address?.value },
                              bank_account: { ...prev.company.bank_account, ...body.bank_account },
                              observations: body.observations ?? prev.company.observations,
                          },
                      }
                    : prev,
            );
            successToast(message);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al actualizar la empresa");
            throw error;
        }
    };

    const reloadDetail = useCallback(async () => {
        if (!companyId) return;
        try {
            const d = await adminGetCompany(companyId);
            setDetail(d);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al recargar la empresa");
        }
    }, [companyId]);

    const runPrefixAction = async (fn: () => Promise<void>, okMsg: string) => {
        setPrefixActionLoading(true);
        try {
            await fn();
            await reloadDetail();
            successToast(okMsg);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error en la operación del prefijo");
        } finally {
            setPrefixActionLoading(false);
        }
    };

    const handleAddPrefix = async (prefix: string, resolution: AdminPrefixResolutionInput) => {
        if (!companyId) return;
        try {
            await adminAddPrefix(companyId, prefix, resolution);
            await reloadDetail();
            successToast("Prefijo agregado");
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al agregar el prefijo");
            throw error;
        }
    };

    const handleUpdatePrefix = async (prefix: string, resolution: AdminPrefixResolutionInput) => {
        if (!companyId) return;
        try {
            await adminUpdatePrefix(companyId, prefix, resolution);
            await reloadDetail();
            successToast("Prefijo actualizado");
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al actualizar el prefijo");
            throw error;
        }
    };

    const refetchSubscription = useCallback(async () => {
        if (!companyId) return;
        try {
            const s = await adminGetCompanySubscription(companyId);
            setSubscription(s);
        } catch {
            // ignore
        }
        await reloadDetail();
    }, [companyId, reloadDetail]);

    const handleDeleteConfirm = async () => {
        if (!confirmDelete || !companyId) return;
        setDeleteLoading(true);
        try {
            if (confirmDelete.kind === "client") {
                await adminDeleteClient(companyId, confirmDelete.id);
                setClientsReload((t) => t + 1);
            } else if (confirmDelete.kind === "item") {
                await adminDeleteItem(companyId, confirmDelete.id);
                setItemsReload((t) => t + 1);
            } else {
                await adminDeleteSubUser(confirmDelete.id);
                setSubUsersReload((t) => t + 1);
            }
            successToast("Eliminado correctamente");
            setConfirmDelete(null);
            await reloadDetail();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al eliminar");
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleResetSubmit = async (password: string) => {
        if (!resetTarget) return;
        try {
            const message =
                resetTarget.kind === "company"
                    ? await adminResetCompanyPassword(resetTarget.id, password)
                    : await adminResetSubUserPassword(resetTarget.id, password);
            successToast(message);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al restablecer la contraseña");
            throw error;
        }
    };

    return (
        <main className="admin-page container-scroll">
            <button type="button" className="admin-back" onClick={() => navigate(PATHS.ADMIN_HOME)}>
                <i className="ri-arrow-left-line" /> Volver a empresas
            </button>

            {loading ? (
                <div className="admin-loading">Cargando información…</div>
            ) : !company ? (
                <div className="admin-empty">No se pudo cargar la empresa.</div>
            ) : (
                <div className="admin-detail-grid">
                    {/* Información de la empresa */}
                    <section className="admin-section-card">
                        <div className="admin-section-header">
                            <div className="admin-detail-head">
                                <div className="admin-logo admin-logo-lg">
                                    {company.logo?.url ? <img src={company.logo.url} alt={company.razon_social} /> : <i className="ri-building-line" />}
                                </div>
                                <h2>{company.razon_social}</h2>
                            </div>
                            <div className="admin-section-actions">
                                <span className={`admin-badge ${company.active ? "admin-badge-active" : "admin-badge-inactive"}`}>{company.active ? "Activa" : "Inactiva"}</span>
                                <button type="button" className="admin-btn-secondary" onClick={() => setEditing(true)}>
                                    <i className="ri-edit-line" />
                                    Editar
                                </button>
                                <button type="button" className={`admin-btn-secondary ${company.active ? "admin-btn-danger" : ""}`} onClick={() => setConfirmToggle(true)}>
                                    <i className={company.active ? "ri-forbid-line" : "ri-checkbox-circle-line"} />
                                    {company.active ? "Desactivar" : "Activar"}
                                </button>
                                <button
                                    type="button"
                                    className="admin-btn-secondary"
                                    onClick={() => setResetTarget({ kind: "company", id: company._id, label: company.razon_social })}
                                >
                                    <i className="ri-lock-password-line" />
                                    Restablecer contraseña
                                </button>
                            </div>
                        </div>
                        <div className="admin-info-grid">
                            <InfoItem label="Tipo de documento" value={company.doc_type?.value} />
                            <InfoItem label="Número de documento" value={`${company.doc_number ?? ""}${company.doc_number_dv ? `-${company.doc_number_dv}` : ""}`} />
                            <InfoItem label="Correo" value={company.email} />
                            <InfoItem label="Teléfono" value={company.phone} />
                            <InfoItem label="Sitio web" value={company.website} />
                            <InfoItem label="Dirección" value={company.address?.value} />
                            <InfoItem label="Banco" value={company.bank_account?.name} />
                            <InfoItem label="N° de cuenta" value={company.bank_account?.account_number} />
                            <InfoItem label="Observaciones" value={company.observations} />
                        </div>

                        <div className="admin-stats-row">
                            <div className="admin-stat">
                                <span className="admin-stat-value">{detail?.stats?.facturas ?? 0}</span>
                                <span className="admin-stat-label">Facturas</span>
                            </div>
                            <div className="admin-stat">
                                <span className="admin-stat-value">{detail?.stats?.items ?? 0}</span>
                                <span className="admin-stat-label">Items</span>
                            </div>
                            <div className="admin-stat">
                                <span className="admin-stat-value">{detail?.stats?.clientes ?? 0}</span>
                                <span className="admin-stat-label">Clientes</span>
                            </div>
                            <div className="admin-stat">
                                <span className="admin-stat-value">{detail?.stats?.prefijos ?? 0}</span>
                                <span className="admin-stat-label">Prefijos</span>
                            </div>
                        </div>
                    </section>

                    {/* Suscripción */}
                    <section className="admin-section-card">
                        <div className="admin-section-header">
                            <h2>Suscripción</h2>
                            <div className="admin-section-actions">
                                {sub?.status ? (
                                    <span className={`admin-badge ${sub.status === "active" ? "admin-badge-active" : "admin-badge-inactive"}`}>
                                        {SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status}
                                    </span>
                                ) : null}
                                <button type="button" className="admin-btn-secondary" onClick={() => setEditingSubscription(true)}>
                                    <i className={sub ? "ri-edit-line" : "ri-add-line"} />
                                    {sub ? "Editar suscripción" : "Crear suscripción"}
                                </button>
                            </div>
                        </div>
                        {sub ? (
                            <div className="admin-info-grid">
                                <InfoItem label="Plan" value={subscription?.plan?.title} />
                                <InfoItem label="Inicio" value={formatDate(sub.start_date)} />
                                <InfoItem label="Vencimiento" value={formatDate(sub.end_date)} />
                                <InfoItem label="Documentos" value={`${sub.used_documents ?? 0} / ${sub.total_documents ?? 0}`} />
                                <InfoItem label="Valor del plan" value={formatCurrencyCOP(sub.total_price)} />
                                <InfoItem label="Último pago" value={formatDate(sub.last_payment_date)} />
                            </div>
                        ) : (
                            <p className="admin-empty" style={{ padding: "0.5rem 0" }}>
                                Esta empresa no tiene una suscripción registrada.
                            </p>
                        )}
                    </section>

                    {/* Listados (facturas, clientes, items, subusuarios) */}
                    <section className="admin-section-card">
                        <div className="admin-tabs">
                            <button type="button" className={`admin-tab ${activeTab === "prefijos" ? "active" : ""}`} onClick={() => setActiveTab("prefijos")}>
                                Prefijos ({detail?.stats?.prefijos ?? company.prefixes?.length ?? 0})
                            </button>
                            <button type="button" className={`admin-tab ${activeTab === "facturas" ? "active" : ""}`} onClick={() => setActiveTab("facturas")}>
                                Facturas ({detail?.stats?.facturas ?? 0})
                            </button>
                            <button type="button" className={`admin-tab ${activeTab === "clientes" ? "active" : ""}`} onClick={() => setActiveTab("clientes")}>
                                Clientes ({detail?.stats?.clientes ?? 0})
                            </button>
                            <button type="button" className={`admin-tab ${activeTab === "items" ? "active" : ""}`} onClick={() => setActiveTab("items")}>
                                Items ({detail?.stats?.items ?? 0})
                            </button>
                            <button type="button" className={`admin-tab ${activeTab === "subusuarios" ? "active" : ""}`} onClick={() => setActiveTab("subusuarios")}>
                                Subusuarios
                            </button>
                        </div>

                        {activeTab === "prefijos" && (
                            <div>
                                <div className="admin-section-actions" style={{ justifyContent: "flex-end", marginBottom: "1rem" }}>
                                    <button type="button" className="admin-btn-primary" onClick={() => setAddingPrefix(true)}>
                                        <i className="ri-add-line" />
                                        Agregar prefijo
                                    </button>
                                </div>
                                {!company.prefixes || company.prefixes.length === 0 ? (
                                    <div className="admin-empty">Esta empresa no tiene prefijos.</div>
                                ) : (
                                    <div className="admin-prefix-list">
                                        {company.prefixes.map((p: CompanyPrefix) => {
                                            const r = p.resolution;
                                            const inactive = r?.status === "inactive";
                                            return (
                                                <div className="admin-prefix" key={p.prefix}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className="admin-prefix-main">
                                                            <span className="admin-prefix-code">{p.prefix}</span>
                                                            {p.default ? <span className="admin-badge admin-badge-active">Por defecto</span> : null}
                                                            <span className={`admin-badge ${inactive ? "admin-badge-inactive" : "admin-badge-active"}`}>{inactive ? "Inactivo" : "Activo"}</span>
                                                        </div>
                                                        <div className="admin-prefix-meta">
                                                            Resolución {r?.resolution || "—"} · Rango {r?.init ?? "—"}–{r?.end ?? "—"} · Tipo doc {r?.tipo_doc_electronico || "—"} / factura {r?.tipo_factura || "—"}
                                                        </div>
                                                    </div>
                                                    <div className="admin-prefix-actions">
                                                        <button type="button" className="admin-btn-secondary" disabled={prefixActionLoading} onClick={() => setEditingPrefix(p)}>
                                                            <i className="ri-edit-line" /> Editar
                                                        </button>
                                                        {!p.default ? (
                                                            <button type="button" className="admin-btn-secondary" disabled={prefixActionLoading} onClick={() => runPrefixAction(() => adminSetPrefixDefault(companyId!, p.prefix), "Prefijo por defecto actualizado")}>
                                                                <i className="ri-star-line" /> Por defecto
                                                            </button>
                                                        ) : null}
                                                        <button
                                                            type="button"
                                                            className="admin-btn-secondary"
                                                            disabled={prefixActionLoading}
                                                            onClick={() => runPrefixAction(() => adminSetPrefixStatus(companyId!, p.prefix, inactive ? "active" : "inactive"), "Estado del prefijo actualizado")}
                                                        >
                                                            <i className={inactive ? "ri-checkbox-circle-line" : "ri-forbid-line"} /> {inactive ? "Activar" : "Desactivar"}
                                                        </button>
                                                        <button type="button" className="admin-btn-secondary admin-btn-danger" disabled={prefixActionLoading} onClick={() => setPrefixToDelete(p.prefix)}>
                                                            <i className="ri-delete-bin-line" /> Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "facturas" && (
                            <PaginatedTable<AdminInvoice>
                                fetchPage={fetchInvoices}
                                rowKey={(r) => r._id}
                                emptyText="Esta empresa no tiene facturas."
                                columns={[
                                    { header: "Número", render: (r) => r.number },
                                    { header: "Fecha", render: (r) => formatShortDate(r.date) },
                                    { header: "Cliente", render: (r) => r.client },
                                    { header: "Total", align: "right", render: (r) => formatCurrencyCOP(r.total) },
                                    {
                                        header: "Estado",
                                        render: (r) =>
                                            r.is_draft ? (
                                                <span className="admin-badge admin-badge-warning">Borrador</span>
                                            ) : (
                                                <span className={`admin-badge ${INVOICE_STATUS[r.status]?.cls ?? "admin-badge-warning"}`}>{INVOICE_STATUS[r.status]?.label ?? r.status}</span>
                                            ),
                                    },
                                ]}
                            />
                        )}

                        {activeTab === "clientes" && (
                            <PaginatedTable<AdminClient>
                                fetchPage={fetchClients}
                                reloadToken={clientsReload}
                                rowKey={(r) => r._id}
                                emptyText="Esta empresa no tiene clientes."
                                columns={[
                                    { header: "Nombre", render: (r) => r.name },
                                    { header: "Documento", render: (r) => `${r.doc_number ?? "—"}${r.doc_number_dv ? `-${r.doc_number_dv}` : ""}` },
                                    { header: "Correo", render: (r) => r.email || "—" },
                                    { header: "Teléfono", render: (r) => r.phone || "—" },
                                    {
                                        header: "",
                                        align: "right",
                                        render: (r) => (
                                            <div className="admin-prefix-actions" style={{ justifyContent: "flex-end" }}>
                                                <button type="button" className="admin-btn-secondary" onClick={() => setClientEdit(r)}>
                                                    <i className="ri-edit-line" /> Editar
                                                </button>
                                                <button type="button" className="admin-btn-secondary admin-btn-danger" onClick={() => setConfirmDelete({ kind: "client", id: r._id, label: r.name })}>
                                                    <i className="ri-delete-bin-line" /> Eliminar
                                                </button>
                                            </div>
                                        ),
                                    },
                                ]}
                            />
                        )}

                        {activeTab === "items" && (
                            <PaginatedTable<AdminItem>
                                fetchPage={fetchItems}
                                reloadToken={itemsReload}
                                rowKey={(r) => r._id}
                                emptyText="Esta empresa no tiene items."
                                columns={[
                                    { header: "Nombre", render: (r) => r.name },
                                    { header: "Código", render: (r) => r.code || "—" },
                                    { header: "Tipo", render: (r) => (r.kind === "service" ? "Servicio" : r.kind === "product" ? "Producto" : "—") },
                                    { header: "Precio", align: "right", render: (r) => formatCurrencyCOP(r.price) },
                                    {
                                        header: "",
                                        align: "right",
                                        render: (r) => (
                                            <div className="admin-prefix-actions" style={{ justifyContent: "flex-end" }}>
                                                <button type="button" className="admin-btn-secondary" onClick={() => setItemEdit(r)}>
                                                    <i className="ri-edit-line" /> Editar
                                                </button>
                                                <button type="button" className="admin-btn-secondary admin-btn-danger" onClick={() => setConfirmDelete({ kind: "item", id: r._id, label: r.name })}>
                                                    <i className="ri-delete-bin-line" /> Eliminar
                                                </button>
                                            </div>
                                        ),
                                    },
                                ]}
                            />
                        )}

                        {activeTab === "subusuarios" && (
                            <>
                                <div className="admin-section-actions" style={{ justifyContent: "flex-end", marginBottom: "1rem" }}>
                                    <button type="button" className="admin-btn-primary" onClick={() => setSubUserModal("new")}>
                                        <i className="ri-add-line" /> Nuevo subusuario
                                    </button>
                                </div>
                                <PaginatedTable<AdminSubUser>
                                    fetchPage={fetchSubUsers}
                                    reloadToken={subUsersReload}
                                    rowKey={(r) => r._id}
                                    emptyText="Esta empresa no tiene subusuarios."
                                    columns={[
                                        { header: "Nombre", render: (r) => `${r.name} ${r.last_name}` },
                                        { header: "Correo", render: (r) => r.email },
                                        { header: "Teléfono", render: (r) => r.phone || "—" },
                                        {
                                            header: "Estado",
                                            render: (r) => <span className={`admin-badge ${r.active ? "admin-badge-active" : "admin-badge-inactive"}`}>{r.active ? "Activo" : "Inactivo"}</span>,
                                        },
                                        {
                                            header: "",
                                            align: "right",
                                            render: (r) => (
                                                <div className="admin-prefix-actions" style={{ justifyContent: "flex-end" }}>
                                                    <button type="button" className="admin-btn-secondary" onClick={() => setSubUserModal(r)}>
                                                        <i className="ri-edit-line" /> Editar
                                                    </button>
                                                    <button type="button" className="admin-btn-secondary" onClick={() => setResetTarget({ kind: "subuser", id: r._id, label: `${r.name} ${r.last_name}` })}>
                                                        <i className="ri-lock-password-line" /> Contraseña
                                                    </button>
                                                    <button type="button" className="admin-btn-secondary admin-btn-danger" onClick={() => setConfirmDelete({ kind: "subuser", id: r._id, label: `${r.name} ${r.last_name}` })}>
                                                        <i className="ri-delete-bin-line" /> Eliminar
                                                    </button>
                                                </div>
                                            ),
                                        },
                                    ]}
                                />
                            </>
                        )}
                    </section>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmToggle}
                onClose={() => setConfirmToggle(false)}
                onConfirm={handleToggleActive}
                title={company?.active ? "Desactivar empresa" : "Activar empresa"}
                message={
                    company?.active
                        ? `¿Desactivar a "${company?.razon_social}"? No podrá iniciar sesión ni facturar mientras esté inactiva.`
                        : `¿Activar a "${company?.razon_social}"?`
                }
                confirmText={company?.active ? "Desactivar" : "Activar"}
                type={company?.active ? "danger" : "info"}
                loading={toggleLoading}
            />

            {resetTarget ? <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} onSubmit={handleResetSubmit} /> : null}

            {editing && company ? <EditCompanyModal company={company} onClose={() => setEditing(false)} onSaved={handleEditSave} /> : null}

            {addingPrefix ? <PrefixModal onClose={() => setAddingPrefix(false)} onSubmit={handleAddPrefix} /> : null}

            {editingPrefix ? <PrefixModal editPrefix={editingPrefix} onClose={() => setEditingPrefix(null)} onSubmit={handleUpdatePrefix} /> : null}

            {clientEdit && companyId ? (
                <ClientModal
                    companyId={companyId}
                    client={clientEdit}
                    onClose={() => setClientEdit(null)}
                    onSaved={async () => {
                        setClientsReload((t) => t + 1);
                    }}
                />
            ) : null}

            {itemEdit && companyId ? (
                <ItemModal
                    companyId={companyId}
                    item={itemEdit}
                    onClose={() => setItemEdit(null)}
                    onSaved={async () => {
                        setItemsReload((t) => t + 1);
                    }}
                />
            ) : null}

            <ConfirmModal
                isOpen={prefixToDelete !== null}
                onClose={() => setPrefixToDelete(null)}
                onConfirm={() => {
                    const pfx = prefixToDelete;
                    if (pfx) runPrefixAction(() => adminRemovePrefix(companyId!, pfx), "Prefijo eliminado").then(() => setPrefixToDelete(null));
                }}
                title="Eliminar prefijo"
                message={`¿Eliminar el prefijo "${prefixToDelete}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                type="danger"
                loading={prefixActionLoading}
            />

            {editingSubscription && companyId ? (
                <SubscriptionModal companyId={companyId} subscription={subscription} onClose={() => setEditingSubscription(false)} onSaved={refetchSubscription} />
            ) : null}

            {subUserModal && companyId ? (
                <SubUserModal
                    companyId={companyId}
                    subUser={subUserModal === "new" ? null : subUserModal}
                    onClose={() => setSubUserModal(null)}
                    onSaved={async () => {
                        setSubUsersReload((t) => t + 1);
                        await reloadDetail();
                    }}
                />
            ) : null}

            <ConfirmModal
                isOpen={confirmDelete !== null}
                onClose={() => setConfirmDelete(null)}
                onConfirm={handleDeleteConfirm}
                title={confirmDelete?.kind === "client" ? "Eliminar cliente" : confirmDelete?.kind === "item" ? "Eliminar item" : "Eliminar subusuario"}
                message={`¿Eliminar "${confirmDelete?.label}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                type="danger"
                loading={deleteLoading}
            />
        </main>
    );
};

export default AdminCompanyDetail;
