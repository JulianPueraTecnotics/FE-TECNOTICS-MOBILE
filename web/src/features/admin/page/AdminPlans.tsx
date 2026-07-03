import { useEffect, useState } from "react";
import "./Admin.css";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { ConfirmModal } from "../../../components/modals";
import { AppModal, FilterField, FieldControl } from "../../../components/design-system";
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
        <AppModal
            wide
            title={plan ? "Editar plan" : "Nuevo plan"}
            onClose={onClose}
            closeDisabled={loading}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="submit" form="admin-plan-form" className="export-submit" disabled={loading}>
                        {loading ? "Guardando…" : plan ? "Guardar" : "Crear plan"}
                    </button>
                </>
            }
        >
            <form id="admin-plan-form" className="admin-form" onSubmit={submit}>
                <div className="led-form-grid">
                    <FilterField className="led-form-grid__full" label="Título" htmlFor="pl-title" icon="ri-price-tag-3-line">
                        <FieldControl id="pl-title" type="text" value={form.title} onChange={(e) => setField("title", e.target.value)} />
                    </FilterField>
                    <FilterField className="led-form-grid__full" label="Descripción" htmlFor="pl-desc" icon="ri-file-text-line">
                        <FieldControl id="pl-desc" type="text" value={form.description} onChange={(e) => setField("description", e.target.value)} />
                    </FilterField>
                    <FilterField label="Precio (COP)" htmlFor="pl-price" icon="ri-money-dollar-circle-line">
                        <FieldControl id="pl-price" type="text" inputMode="numeric" value={form.price} onChange={(e) => setField("price", e.target.value.replace(/[^\d]/g, ""))} />
                    </FilterField>
                    <FilterField label="Documentos incluidos" htmlFor="pl-docs" icon="ri-file-list-3-line">
                        <FieldControl id="pl-docs" type="text" inputMode="numeric" value={form.include_documents} onChange={(e) => setField("include_documents", e.target.value.replace(/[^\d]/g, ""))} />
                    </FilterField>
                    <FilterField label="Tipo" htmlFor="pl-type" icon="ri-calendar-line">
                        <FieldControl as="select" id="pl-type" value={form.type} onChange={(e) => setField("type", e.target.value as "1year" | "trial2days")}>
                            <option value="1year">Anual</option>
                            <option value="trial2days">Prueba (2 días)</option>
                        </FieldControl>
                    </FilterField>
                    <FilterField label="Público (visible en la web)" htmlFor="pl-public" icon="ri-eye-line">
                        <FieldControl id="pl-public" type="checkbox" checked={form.is_public} onChange={(e) => setField("is_public", e.target.checked)} />
                    </FilterField>
                    <FilterField className="led-form-grid__full" label="Características (una por línea)" htmlFor="pl-features" icon="ri-list-check">
                        <FieldControl as="textarea" id="pl-features" rows={4} value={form.features} onChange={(e) => setField("features", e.target.value)} />
                    </FilterField>
                </div>
            </form>
        </AppModal>
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
