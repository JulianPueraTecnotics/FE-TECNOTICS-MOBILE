import { useEffect, useState } from "react";
import "./Admin.css";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal, FilterField, FieldControl } from "../../../components/design-system";
import { adminCreateAdmin, adminListAdmins, type AdminAccount } from "../services/admin_companies.service";

const formatDate = (value?: string) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
};

const emptyForm = { name: "", last_name: "", email: "", password: "" };

const CreateAdminModal: React.FC<{ onClose: () => void; onCreated: (admin: AdminAccount) => void }> = ({ onClose, onCreated }) => {
    const [form, setForm] = useState(emptyForm);
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);

    const setField = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.last_name.trim() || !form.email.trim()) {
            errorToast("Nombre, apellido y correo son obligatorios.");
            return;
        }
        if (form.password.length < 8) {
            errorToast("La contraseña debe tener al menos 8 caracteres.");
            return;
        }
        setLoading(true);
        try {
            const created = await adminCreateAdmin({
                name: form.name.trim(),
                last_name: form.last_name.trim(),
                email: form.email.trim(),
                password: form.password,
            });
            successToast("Administrador creado");
            onCreated(created);
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al crear el administrador");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppModal
            title="Nuevo administrador"
            onClose={onClose}
            closeDisabled={loading}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="submit" form="create-admin-form" className="export-submit" disabled={loading}>
                        {loading ? "Creando…" : "Crear administrador"}
                    </button>
                </>
            }
        >
            <form id="create-admin-form" className="admin-form" onSubmit={submit}>
                <div className="led-form-grid">
                    <FilterField label="Nombre" htmlFor="adm-name" icon="ri-user-line">
                        <FieldControl id="adm-name" type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                    </FilterField>
                    <FilterField label="Apellido" htmlFor="adm-lastname" icon="ri-user-line">
                        <FieldControl id="adm-lastname" type="text" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
                    </FilterField>
                    <FilterField className="led-form-grid__full" label="Correo electrónico" htmlFor="adm-email" icon="ri-mail-line">
                        <FieldControl id="adm-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} autoComplete="off" />
                    </FilterField>
                    <FilterField
                        className="led-form-grid__full"
                        label="Contraseña"
                        htmlFor="adm-pwd"
                        icon="ri-lock-password-line"
                        hint={
                            <button type="button" className="admin-btn-secondary" onClick={() => setShow((v) => !v)} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                                {show ? "Ocultar" : "Mostrar"} contraseña
                            </button>
                        }
                    >
                        <FieldControl id="adm-pwd" type={show ? "text" : "password"} value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                    </FilterField>
                </div>
            </form>
        </AppModal>
    );
};

const AdminAdmins: React.FC = () => {
    const [admins, setAdmins] = useState<AdminAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const load = () => {
        setLoading(true);
        adminListAdmins()
            .then(setAdmins)
            .catch((error: unknown) => errorToast(error instanceof Error ? error.message : "Error al listar los administradores"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <main className="admin-page container-scroll">
            <div className="admin-page-header">
                <div>
                    <h1>Administradores</h1>
                    <p>{admins.length} administrador(es)</p>
                </div>
                <div className="admin-header-actions">
                    <button type="button" className="admin-btn-primary" onClick={() => setShowCreate(true)}>
                        <i className="ri-add-line" />
                        Nuevo administrador
                    </button>
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-loading">Cargando administradores…</div>
                ) : admins.length === 0 ? (
                    <div className="admin-empty">No hay administradores.</div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Correo</th>
                                <th>Estado</th>
                                <th>Creado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {admins.map((a) => (
                                <tr key={a._id}>
                                    <td>
                                        {a.name} {a.last_name}
                                    </td>
                                    <td>{a.email}</td>
                                    <td>
                                        <span className={`admin-badge ${a.active ? "admin-badge-active" : "admin-badge-inactive"}`}>{a.active ? "Activo" : "Inactivo"}</span>
                                    </td>
                                    <td>{formatDate(a.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showCreate ? <CreateAdminModal onClose={() => setShowCreate(false)} onCreated={() => load()} /> : null}
        </main>
    );
};

export default AdminAdmins;
