import { useEffect, useState } from "react";
import { getRoles, getPermissionsCatalog, createRole, updateRole, deleteRole, seedDefaultRoles } from "../accounting.service";
import type { Role, PermissionGroup } from "../accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import { FilterField, FieldControl, CheckCard } from "../../../components/design-system";

const Roles: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [groups, setGroups] = useState<PermissionGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Role | null>(null);
    const [name, setName] = useState("");
    const [perms, setPerms] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [toDelete, setToDelete] = useState<Role | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [r, p] = await Promise.all([getRoles(), getPermissionsCatalog()]);
            setRoles(r.roles);
            setGroups(p.groups);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);

    const startNew = () => {
        setEditing(null);
        setName("");
        setPerms(new Set());
    };
    const startEdit = (r: Role) => {
        setEditing(r);
        setName(r.name);
        setPerms(new Set(r.permissions));
    };
    const togglePerm = (code: string) => {
        setPerms((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const save = async () => {
        if (!name.trim()) {
            errorToast("El nombre del rol es requerido");
            return;
        }
        setSaving(true);
        try {
            if (editing) await updateRole(editing._id, name.trim(), [...perms]);
            else await createRole(name.trim(), [...perms]);
            successToast(editing ? "Rol actualizado" : "Rol creado");
            startNew();
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSaving(false);
        }
    };

    const seed = async () => {
        setSeeding(true);
        try {
            const res = await seedDefaultRoles();
            successToast(res.created > 0 ? `${res.created} rol(es) por defecto creado(s)` : "Los roles por defecto ya existen");
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSeeding(false);
        }
    };

    const remove = async () => {
        if (!toDelete) return;
        try {
            await deleteRole(toDelete._id);
            successToast("Rol eliminado");
            if (editing?._id === toDelete._id) startNew();
            setToDelete(null);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    return (
        <div className="acc-card">
            <h2>Roles y permisos</h2>
            <p className="acc-sub">Define roles con permisos por módulo para los usuarios de tu empresa.</p>

            <div className="acc-roles-layout">
                <div className="acc-roles-list">
                    {loading ? (
                        <p className="acc-sub">Cargando...</p>
                    ) : roles.length === 0 ? (
                        <p className="acc-sub">Sin roles aún.</p>
                    ) : (
                        <ul className="acc-rolelist">
                            {roles.map((r) => (
                                <li key={r._id} className={editing?._id === r._id ? "active" : ""}>
                                    <button className="acc-rolelist__name" onClick={() => startEdit(r)}>{r.name}<span>{r.permissions.length} permiso(s)</span></button>
                                    <button className="btn-action" title="Eliminar" onClick={() => setToDelete(r)}><i className="ri-delete-bin-line" /></button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="acc-roles-editor">
                    <div className="acc-roles-toolbar">
                        <button type="button" className="btn-secondary" onClick={startNew}>
                            <i className="ri-add-line" aria-hidden /> Nuevo rol
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={seed}
                            disabled={seeding}
                            title="Crea los roles típicos del software (Administrador, Tesorero, Contador, etc.)"
                        >
                            <i className="ri-magic-line" aria-hidden /> {seeding ? "Creando..." : "Roles por defecto"}
                        </button>
                    </div>
                    <FilterField label="Nombre del rol" htmlFor="role-name" icon="ri-shield-user-line">
                        <FieldControl id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Contador" />
                    </FilterField>
                    {groups.map((g) => (
                        <div key={g.module} className="acc-perm-group">
                            <h4>{g.module}</h4>
                            <div className="acc-perm-grid">
                                {g.permissions.map((p) => (
                                    <CheckCard
                                        key={p.code}
                                        icon="ri-shield-check-line"
                                        label={p.label}
                                        checked={perms.has(p.code)}
                                        onChange={() => togglePerm(p.code)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="acc-actions">
                        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : editing ? "Actualizar rol" : "Crear rol"}</button>
                    </div>
                </div>
            </div>

            <ConfirmModal isOpen={!!toDelete} title="Eliminar rol" message={`¿Eliminar el rol "${toDelete?.name}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={remove} />
        </div>
    );
};

export default Roles;
