import { useEffect, useState } from "react";
import "./Admin.css";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { adminListCompanies, type AdminCompanyListItem } from "../services/admin_companies.service";
import { adminListContadores, adminCreateContador, adminUpdateContador, adminDeleteContador, type ContadorRow } from "../../contador/contador.service";
import { AppModal, FilterField, FieldControl, useConfirm } from "../../../components/design-system";

const emptyForm = { name: "", last_name: "", email: "", password: "" };

const ContadorModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
    const [form, setForm] = useState(emptyForm);
    const [companies, setCompanies] = useState<AdminCompanyListItem[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    useEffect(() => { adminListCompanies({ page: 1, limit: 200 }).then((r) => setCompanies(r.companies)).catch(() => setCompanies([])); }, []);

    const setField = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
    const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.last_name.trim() || !form.email.trim()) { errorToast("Nombre, apellido y correo son obligatorios."); return; }
        if (form.password.length < 8) { errorToast("La contraseña debe tener al menos 8 caracteres."); return; }
        if (selected.size === 0) { errorToast("Asigna al menos una empresa."); return; }
        setLoading(true);
        try {
            await adminCreateContador({ name: form.name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), password: form.password, companies_assigned: [...selected] });
            successToast("Contador creado");
            onSaved();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al crear el contador");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppModal
            wide
            title="Nuevo contador"
            onClose={onClose}
            closeDisabled={loading}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button type="submit" form="create-contador-form" className="export-submit" disabled={loading}>
                        {loading ? "Creando…" : "Crear contador"}
                    </button>
                </>
            }
        >
            <form id="create-contador-form" className="admin-form" onSubmit={submit}>
                <div className="led-form-grid">
                    <FilterField label="Nombre" htmlFor="cont-name" icon="ri-user-line">
                        <FieldControl id="cont-name" type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} />
                    </FilterField>
                    <FilterField label="Apellido" htmlFor="cont-lastname" icon="ri-user-line">
                        <FieldControl id="cont-lastname" type="text" value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} />
                    </FilterField>
                    <FilterField className="led-form-grid__full" label="Correo electrónico" htmlFor="cont-email" icon="ri-mail-line">
                        <FieldControl id="cont-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} autoComplete="off" />
                    </FilterField>
                    <FilterField className="led-form-grid__full" label="Contraseña" htmlFor="cont-pwd" icon="ri-lock-password-line">
                        <FieldControl id="cont-pwd" type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                    </FilterField>
                    <FilterField className="led-form-grid__full" label={`Empresas asignadas (${selected.size})`} htmlFor="cont-companies" icon="ri-building-line">
                        <div id="cont-companies" style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-light)", borderRadius: 8, padding: 8, width: "100%" }}>
                            {companies.map((c) => (
                                <label key={c._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", cursor: "pointer", fontWeight: 400 }}>
                                    <input type="checkbox" checked={selected.has(c._id)} onChange={() => toggle(c._id)} />
                                    {c.razon_social}
                                </label>
                            ))}
                            {companies.length === 0 && <p className="admin-empty" style={{ margin: 0 }}>No hay empresas.</p>}
                        </div>
                    </FilterField>
                </div>
            </form>
        </AppModal>
    );
};

const AdminContadores: React.FC = () => {
    const { confirm } = useConfirm();
    const [rows, setRows] = useState<ContadorRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);

    const load = () => {
        setLoading(true);
        adminListContadores().then(setRows).catch((e: unknown) => errorToast(e instanceof Error ? e.message : "Error al listar contadores")).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const toggleActive = async (c: ContadorRow) => {
        try { await adminUpdateContador(c._id, { active: !c.active }); load(); }
        catch (e) { errorToast(e instanceof Error ? e.message : "Error"); }
    };
    const remove = async (c: ContadorRow) => {
        if (!(await confirm(`¿Eliminar al contador ${c.name} ${c.last_name}?`))) return;
        try { await adminDeleteContador(c._id); load(); }
        catch (e) { errorToast(e instanceof Error ? e.message : "Error"); }
    };

    return (
        <main className="admin-page container-scroll">
            <div className="admin-page-header">
                <div>
                    <h1>Contadores</h1>
                    <p>{rows.length} contador(es) · gestionan varias empresas</p>
                </div>
                <div className="admin-header-actions">
                    <button type="button" className="admin-btn-primary" onClick={() => setShowCreate(true)}><i className="ri-add-line" /> Nuevo contador</button>
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-loading">Cargando contadores…</div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty">No hay contadores. Crea uno y asígnale empresas.</div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr><th>Nombre</th><th>Correo</th><th>Empresas</th><th>Estado</th><th>Acciones</th></tr>
                        </thead>
                        <tbody>
                            {rows.map((c) => (
                                <tr key={c._id}>
                                    <td>{c.name} {c.last_name}</td>
                                    <td>{c.email}</td>
                                    <td>{c.empresas}</td>
                                    <td><span className={`admin-badge ${c.active ? "admin-badge-active" : "admin-badge-inactive"}`}>{c.active ? "Activo" : "Inactivo"}</span></td>
                                    <td>
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <button className="admin-btn-secondary" onClick={() => toggleActive(c)}>{c.active ? "Desactivar" : "Activar"}</button>
                                            <button className="admin-btn-secondary" onClick={() => remove(c)} style={{ color: "var(--tertiary-color)" }}>Eliminar</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showCreate ? <ContadorModal onClose={() => setShowCreate(false)} onSaved={load} /> : null}
        </main>
    );
};

export default AdminContadores;
