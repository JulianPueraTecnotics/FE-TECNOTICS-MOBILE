import { useEffect, useState } from "react";
import "./Admin.css";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
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
    useBodyScrollLock(true);

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
        <div className="confirm-overlay" onClick={onClose}>
            <div className="confirm-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <h3 className="confirm-title">Nuevo administrador</h3>
                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-form-grid">
                        <div className="admin-field">
                            <label htmlFor="adm-name">Nombre</label>
                            <input id="adm-name" type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                        </div>
                        <div className="admin-field">
                            <label htmlFor="adm-lastname">Apellido</label>
                            <input id="adm-lastname" type="text" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
                        </div>
                    </div>
                    <div className="admin-field">
                        <label htmlFor="adm-email">Correo electrónico</label>
                        <input id="adm-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} autoComplete="off" />
                    </div>
                    <div className="admin-field">
                        <label htmlFor="adm-pwd">Contraseña</label>
                        <input id="adm-pwd" type={show ? "text" : "password"} value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                        <button type="button" className="admin-btn-secondary" onClick={() => setShow((v) => !v)} style={{ alignSelf: "flex-start" }}>
                            {show ? "Ocultar" : "Mostrar"} contraseña
                        </button>
                    </div>
                    <div className="confirm-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="admin-btn-primary" disabled={loading}>
                            {loading ? "Creando…" : "Crear administrador"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
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
