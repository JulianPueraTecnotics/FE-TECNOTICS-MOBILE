import { useEffect, useState } from "react";
import type { Tercero, TerceroRole } from "../terceros.types";
import { ROLE_LABELS } from "../terceros.types";
import { createTercero, updateTercero } from "../terceros.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal, FilterField, FieldControl } from "../../../components/design-system";
import "../../purchases/components/PurchaseModals.css";

interface Props {
    isOpen: boolean;
    tercero: Tercero | null;
    onClose: () => void;
    onSaved: () => void;
}

const ROLES: TerceroRole[] = ["cliente", "proveedor", "empleado", "otro"];

const empty = {
    name: "", doc_number: "", doc_number_dv: "", tipo_persona: "1" as "1" | "2",
    email: "", phone: "", address: "", codigo_municipio: "", codigo_ciiu: "",
    responsable_iva: false, gran_contribuyente: false, autorretenedor: false, regimen_simple: false,
    banco: "", tipo_cuenta: "", numero_cuenta: "",
};

const TerceroModal: React.FC<Props> = ({ isOpen, tercero, onClose, onSaved }) => {
    const [form, setForm] = useState(empty);
    const [roles, setRoles] = useState<TerceroRole[]>(["cliente"]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (tercero) {
            setForm({
                name: tercero.name ?? "", doc_number: tercero.doc_number ?? "", doc_number_dv: tercero.doc_number_dv ?? "",
                tipo_persona: tercero.tipo_persona ?? "1",
                email: tercero.email ?? "", phone: tercero.phone ?? "", address: tercero.address?.value ?? "",
                codigo_municipio: tercero.address?.codigo_municipio ?? "", codigo_ciiu: tercero.codigo_ciiu ?? "",
                responsable_iva: !!tercero.responsable_iva, gran_contribuyente: !!tercero.gran_contribuyente,
                autorretenedor: !!tercero.autorretenedor, regimen_simple: !!tercero.regimen_simple,
                banco: tercero.bank?.banco ?? "", tipo_cuenta: tercero.bank?.tipo_cuenta ?? "", numero_cuenta: tercero.bank?.numero_cuenta ?? "",
            });
            setRoles(tercero.roles?.length ? tercero.roles : ["otro"]);
        } else {
            setForm(empty);
            setRoles(["cliente"]);
        }
    }, [isOpen, tercero]);

    if (!isOpen) return null;

    const set = (k: keyof typeof empty, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
    const toggleRole = (r: TerceroRole) => setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

    const submit = async () => {
        if (!form.name.trim() || !form.doc_number.trim()) { errorToast("Nombre y NIT/documento son obligatorios"); return; }
        if (!roles.length) { errorToast("Selecciona al menos un rol"); return; }
        setSaving(true);
        try {
            const payload: Partial<Tercero> = {
                name: form.name.trim(), doc_number: form.doc_number.trim(), doc_number_dv: form.doc_number_dv.trim() || undefined,
                tipo_persona: form.tipo_persona, email: form.email.trim() || undefined, phone: form.phone.trim() || undefined,
                address: { value: form.address.trim() || undefined, codigo_municipio: form.codigo_municipio.trim() || undefined },
                roles, codigo_ciiu: form.codigo_ciiu.trim() || undefined,
                responsable_iva: form.responsable_iva, gran_contribuyente: form.gran_contribuyente,
                autorretenedor: form.autorretenedor, regimen_simple: form.regimen_simple,
                bank: form.banco || form.numero_cuenta ? { banco: form.banco, tipo_cuenta: form.tipo_cuenta, numero_cuenta: form.numero_cuenta } : undefined,
            };
            if (tercero) await updateTercero(tercero._id, payload);
            else await createTercero(payload);
            successToast(tercero ? "Tercero actualizado" : "Tercero creado");
            onSaved();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppModal
            wide
            title={tercero ? "Editar tercero" : "Nuevo tercero"}
            onClose={onClose}
            closeDisabled={saving}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button type="button" className="export-submit" onClick={submit} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                </>
            }
        >
            <div className="led-form-grid">
                        <FilterField className="led-form-grid__full" label="Nombre / Razón social *" htmlFor="tercero-name" icon="ri-building-line">
                            <FieldControl id="tercero-name" value={form.name} onChange={(e) => set("name", e.target.value)} disabled={saving} required />
                        </FilterField>
                        <FilterField label="NIT / Documento *" htmlFor="tercero-doc" icon="ri-id-card-line">
                            <FieldControl id="tercero-doc" value={form.doc_number} onChange={(e) => set("doc_number", e.target.value)} disabled={saving} required />
                        </FilterField>
                        <FilterField label="DV" htmlFor="tercero-dv" icon="ri-hashtag">
                            <FieldControl id="tercero-dv" value={form.doc_number_dv} onChange={(e) => set("doc_number_dv", e.target.value)} disabled={saving} />
                        </FilterField>
                        <FilterField label="Tipo de persona" htmlFor="tercero-tipo-persona" icon="ri-user-line">
                            <FieldControl as="select" id="tercero-tipo-persona" value={form.tipo_persona} onChange={(e) => set("tipo_persona", e.target.value)} disabled={saving}>
                                <option value="1">Jurídica</option>
                                <option value="2">Natural</option>
                            </FieldControl>
                        </FilterField>
                        <FilterField label="Teléfono" htmlFor="tercero-phone" icon="ri-phone-line">
                            <FieldControl id="tercero-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={saving} />
                        </FilterField>
                        <FilterField className="led-form-grid__full" label="Correo" htmlFor="tercero-email" icon="ri-mail-line">
                            <FieldControl id="tercero-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={saving} />
                        </FilterField>
                        <FilterField className="led-form-grid__full" label="Dirección" htmlFor="tercero-address" icon="ri-map-pin-line">
                            <FieldControl id="tercero-address" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={saving} />
                        </FilterField>
                        <FilterField label="Código municipio (DIAN)" htmlFor="tercero-municipio" icon="ri-map-2-line">
                            <FieldControl id="tercero-municipio" value={form.codigo_municipio} onChange={(e) => set("codigo_municipio", e.target.value)} placeholder="Ej. 05001" disabled={saving} />
                        </FilterField>
                        <FilterField label="Código CIIU" htmlFor="tercero-ciiu" icon="ri-building-4-line">
                            <FieldControl id="tercero-ciiu" value={form.codigo_ciiu} onChange={(e) => set("codigo_ciiu", e.target.value)} disabled={saving} />
                        </FilterField>
                    </div>

                    <p className="pm-hint" style={{ marginTop: 16, fontWeight: 600 }}>Roles</p>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                        {ROLES.map((r) => (
                            <label key={r} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} /> {ROLE_LABELS[r]}
                            </label>
                        ))}
                    </div>

                    <p className="pm-hint" style={{ marginTop: 16, fontWeight: 600 }}>Datos fiscales (DIAN)</p>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <label style={{ display: "inline-flex", gap: 6 }}><input type="checkbox" checked={form.responsable_iva} onChange={(e) => set("responsable_iva", e.target.checked)} /> Responsable de IVA</label>
                        <label style={{ display: "inline-flex", gap: 6 }}><input type="checkbox" checked={form.gran_contribuyente} onChange={(e) => set("gran_contribuyente", e.target.checked)} /> Gran contribuyente</label>
                        <label style={{ display: "inline-flex", gap: 6 }}><input type="checkbox" checked={form.autorretenedor} onChange={(e) => set("autorretenedor", e.target.checked)} /> Autorretenedor</label>
                        <label style={{ display: "inline-flex", gap: 6 }}><input type="checkbox" checked={form.regimen_simple} onChange={(e) => set("regimen_simple", e.target.checked)} /> Régimen Simple (RST)</label>
                    </div>

                    {roles.includes("proveedor") && (
                        <>
                            <p className="pm-hint" style={{ marginTop: 16, fontWeight: 600 }}>Datos bancarios (pago a proveedores)</p>
                            <div className="led-form-grid">
                                <FilterField label="Banco" htmlFor="tercero-banco" icon="ri-bank-line">
                                    <FieldControl id="tercero-banco" value={form.banco} onChange={(e) => set("banco", e.target.value)} disabled={saving} />
                                </FilterField>
                                <FilterField label="Tipo de cuenta" htmlFor="tercero-tipo-cuenta" icon="ri-wallet-3-line">
                                    <FieldControl as="select" id="tercero-tipo-cuenta" value={form.tipo_cuenta} onChange={(e) => set("tipo_cuenta", e.target.value)} disabled={saving}>
                                        <option value="">—</option>
                                        <option value="ahorros">Ahorros</option>
                                        <option value="corriente">Corriente</option>
                                    </FieldControl>
                                </FilterField>
                                <FilterField className="led-form-grid__full" label="Número de cuenta" htmlFor="tercero-numero-cuenta" icon="ri-bank-card-line">
                                    <FieldControl id="tercero-numero-cuenta" value={form.numero_cuenta} onChange={(e) => set("numero_cuenta", e.target.value)} disabled={saving} />
                                </FilterField>
                            </div>
                        </>
                    )}
        </AppModal>
    );
};

export default TerceroModal;
