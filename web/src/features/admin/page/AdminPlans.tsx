import { useEffect, useState } from "react";
import "./Admin.css";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { ConfirmModal } from "../../../components/modals";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { adminCreatePlan, adminDeletePlan, adminListPlans, adminUpdatePlan, type AdminPlan, type AdminPlanBody } from "../services/admin_companies.service";

const formatCurrencyCOP = (value?: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value ?? 0);

const emptyForm = { title: "", description: "", price: "", include_documents: "", type: "1year" as "1year" | "trial2days", is_public: false, features: "" };

const PlanModal: React.FC<{ plan: AdminPlan | null; onClose: () => void; onSaved: () => void }> = ({ plan, onClose, onSaved }) => {
    const [form, setForm] = useState(
        plan
            ? {
                  title: plan.title,
                  description: plan.description,
                  price: String(plan.price),
                  include_documents: String(plan.include_documents),
                  type: plan.type,
                  is_public: Boolean(plan.is_public),
                  features: (plan.features ?? []).join("\n"),
              }
            : emptyForm,
    );
    const [loading, setLoading] = useState(false);
    useBodyScrollLock(true);

    const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return errorToast("El título es obligatorio.");
        const price = Number(form.price);
        const docs = Number(form.include_documents);
        if (!Number.isFinite(price) || price < 0) return errorToast("Precio inválido.");
        if (!Number.isFinite(docs) || docs < 0) return errorToast("Documentos incluidos inválido.");

        const body: AdminPlanBody = {
            title: form.title.trim(),
            description: form.description.trim(),
            price,
            include_documents: docs,
            type: form.type,
            is_public: form.is_public,
            features: form.features
                .split("\n")
                .map((f) => f.trim())
                .filter(Boolean),
        };

        setLoading(true);
        try {
            if (plan) await adminUpdatePlan(plan._id, body);
            else await adminCreatePlan(body);
            successToast(plan ? "Plan actualizado" : "Plan creado");
            onSaved();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al guardar el plan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <h3 className="confirm-title">{plan ? "Editar plan" : "Nuevo plan"}</h3>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-field">
                        <label htmlFor="pl-title">Título</label>
                        <input id="pl-title" type="text" value={form.title} onChange={(e) => setField("title", e.target.value)} />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="pl-desc">Descripción</label>
                        <input id="pl-desc" type="text" value={form.description} onChange={(e) => setField("description", e.target.value)} />
                    </div>
                    <div className="admin-form-grid">
                        <div className="admin-field">
                            <label htmlFor="pl-price">Precio (COP)</label>
                            <input id="pl-price" type="text" inputMode="numeric" value={form.price} onChange={(e) => setField("price", e.target.value.replace(/[^\d]/g, ""))} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pl-docs">Documentos incluidos</label>
                            <input id="pl-docs" type="text" inputMode="numeric" value={form.include_documents} onChange={(e) => setField("include_documents", e.target.value.replace(/[^\d]/g, ""))} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="pl-type">Tipo</label>
                            <select id="pl-type" className="admin-select" value={form.type} onChange={(e) => setField("type", e.target.value as "1year" | "trial2days")}>
                                <option value="1year">Anual</option>
                                <option value="trial2days">Prueba (2 días)</option>
                            </select>
                        </div>
                        <div className="admin-field" style={{ justifyContent: "flex-end" }}>
                            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                <input type="checkbox" checked={form.is_public} onChange={(e) => setField("is_public", e.target.checked)} />
                                Público (visible en la web)
                            </label>
                        </div>
                    </div>
                    <div className="admin-field">
                        <label htmlFor="pl-features">Características (una por línea)</label>
                        <textarea id="pl-features" rows={4} value={form.features} onChange={(e) => setField("features", e.target.value)} className="admin-textarea" />
                    </div>
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Guardando…" : plan ? "Guardar" : "Crear plan"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminPlans: React.FC = () => {
    const [plans, setPlans] = useState<AdminPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<AdminPlan | null>(null);
    const [creating, setCreating] = useState(false);
    const [toDelete, setToDelete] = useState<AdminPlan | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const load = () => {
        setLoading(true);
        adminListPlans()
            .then(setPlans)
            .catch((error: unknown) => errorToast(error instanceof Error ? error.message : "Error al listar los planes"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleteLoading(true);
        try {
            await adminDeletePlan(toDelete._id);
            successToast("Plan eliminado");
            setToDelete(null);
            load();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al eliminar el plan");
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <main className="admin-page container-scroll">
            <div className="admin-page-header">
                <div>
                    <h1>Planes de suscripción</h1>
                    <p>{plans.length} plan(es)</p>
                </div>
                <div className="admin-header-actions">
                    <button type="button" className="admin-btn-primary" onClick={() => setCreating(true)}>
                        <i className="ri-add-line" />
                        Nuevo plan
                    </button>
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-loading">Cargando planes…</div>
                ) : plans.length === 0 ? (
                    <div className="admin-empty">No hay planes.</div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Título</th>
                                <th>Tipo</th>
                                <th>Precio</th>
                                <th>Documentos</th>
                                <th>Público</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((p) => (
                                <tr key={p._id}>
                                    <td>{p.title}</td>
                                    <td>{p.type === "1year" ? "Anual" : "Prueba"}</td>
                                    <td>{formatCurrencyCOP(p.price)}</td>
                                    <td>{p.include_documents}</td>
                                    <td>
                                        <span className={`admin-badge ${p.is_public ? "admin-badge-active" : "admin-badge-inactive"}`}>{p.is_public ? "Sí" : "No"}</span>
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        <div className="admin-prefix-actions" style={{ justifyContent: "flex-end" }}>
                                            <button type="button" className="admin-btn-secondary" onClick={() => setEditing(p)}>
                                                <i className="ri-edit-line" /> Editar
                                            </button>
                                            <button type="button" className="admin-btn-secondary admin-btn-danger" onClick={() => setToDelete(p)}>
                                                <i className="ri-delete-bin-line" /> Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {creating ? <PlanModal plan={null} onClose={() => setCreating(false)} onSaved={load} /> : null}
            {editing ? <PlanModal plan={editing} onClose={() => setEditing(null)} onSaved={load} /> : null}

            <ConfirmModal
                isOpen={toDelete !== null}
                onClose={() => setToDelete(null)}
                onConfirm={confirmDelete}
                title="Eliminar plan"
                message={`¿Eliminar el plan "${toDelete?.title}"?`}
                confirmText="Eliminar"
                type="danger"
                loading={deleteLoading}
            />
        </main>
    );
};

export default AdminPlans;
