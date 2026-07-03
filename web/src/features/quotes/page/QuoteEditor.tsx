import { useState, useEffect, useContext, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import "./QuoteEditor.css";
import type { CreateQuoteRequest, QuoteLine, IExternUser, ItemData, QuotePaymentForm } from "../../../types";
import { AuthContext } from "../../../store/auth.context";
import { PATHS } from "../../../router/paths.contants";
import { createQuote, updateQuote, getQuoteById } from "../../../services/quotes.service";
import { getAllClients } from "../../../services/clients.service";
import { calcQuoteTotals, formatCOP } from "../quotes.utils";
import ProductPicker from "../components/ProductPicker";
import ClientPicker from "../components/ClientPicker";
import { FieldControl } from "../../../components/design-system";
import { useFormDraft, isFormDirty } from "../../../hooks/useFormDraft";
import UnsavedChangesModal from "../../../components/modals/UnsavedChangesModal/UnsavedChangesModal";

const QUOTE_DRAFT_KEY = "tecnotics:draft:quote-editor";

const createEmptyForm = (): CreateQuoteRequest => ({
    client_id: "",
    lines: [],
    payment_form: "Contado",
    payment_method: "Efectivo",
    retenciones: 0,
    notes: "",
    valid_until: "",
});

/** Fecha hoy + 1 mes en YYYY-MM-DD (vencimiento por defecto). */
function defaultVencimiento(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const QuoteEditor: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<CreateQuoteRequest>(() => ({ ...createEmptyForm(), valid_until: defaultVencimiento() }));

    // Selección de cliente (snapshot para mostrar en el panel)
    const [selectedClient, setSelectedClient] = useState<IExternUser | null>(null);

    // Correo principal de envío (editable; puede diferir del correo de facturación del cliente)
    const [mainEmail, setMainEmail] = useState("");
    // Input en curso para añadir destinatarios adicionales (CC)
    const [extraEmailInput, setExtraEmailInput] = useState("");


    // Pickers
    const [showClientPicker, setShowClientPicker] = useState(false);
    const [showProductPicker, setShowProductPicker] = useState(false);

    // Split-button menu
    const [openSendMenu, setOpenSendMenu] = useState(false);
    const [showObs, setShowObs] = useState(false);

    // Draft (solo en creación)
    const draftEnabled = !isEditMode;
    const { loadDraft, saveDraft, clearDraft } = useFormDraft<CreateQuoteRequest>(QUOTE_DRAFT_KEY, draftEnabled);
    const [showUnsaved, setShowUnsaved] = useState(false);
    const splitRef = useRef<HTMLDivElement>(null);

    // ---- Carga inicial: clientes (para restaurar draft) + (si edita) la cotización ----
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const clientsRes = await getAllClients(1, 300);
                if (ignore) return;
                const clients = clientsRes?.clients ?? [];

                if (isEditMode && id) {
                    const res = await getQuoteById(id);
                    const q = res?.quote;
                    if (q && !ignore) {
                        // eslint-disable-next-line react-hooks/set-state-in-effect
                        setFormData({
                            client_id: q.client_id,
                            lines: q.lines ?? [],
                            payment_form: (q.payment_form as QuotePaymentForm) ?? "Contado",
                            payment_method: q.payment_method ?? "Efectivo",
                            retenciones: q.totals?.retenciones ?? 0,
                            notes: q.notes ?? "",
                            valid_until: q.valid_until ? q.valid_until.slice(0, 10) : "",
                            extra_emails: q.extra_emails ?? [],
                        });
                        // Snapshot de cliente desde la cotización
                        // eslint-disable-next-line react-hooks/set-state-in-effect
                        setSelectedClient({
                            _id: q.client_id,
                            name: q.client_name ?? "",
                            doc_number: q.client_doc ?? "",
                            email: q.client_email ?? "",
                            phone: q.client_phone ?? "",
                        } as IExternUser);
                        // eslint-disable-next-line react-hooks/set-state-in-effect
                        setMainEmail(q.client_email ?? "");
                    }
                } else {
                    const draft = loadDraft();
                    if (draft && !ignore) {
                        // eslint-disable-next-line react-hooks/set-state-in-effect
                        setFormData(draft);
                        const c = clients.find((x) => x._id === draft.client_id);
                        // eslint-disable-next-line react-hooks/set-state-in-effect
                        if (c) setSelectedClient(c);
                    }
                }
            } catch (e) {
                if (!ignore) toast.error(e instanceof Error ? e.message : "No se pudo cargar la información");
            }
        })();
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Cerrar menú del split-button al hacer clic fuera
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (splitRef.current && !splitRef.current.contains(e.target as Node)) setOpenSendMenu(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const totals = useMemo(() => calcQuoteTotals(formData.lines, formData.retenciones ?? 0), [formData.lines, formData.retenciones]);

    // ---- Líneas ----
    const addLineFromItem = (it: ItemData) => {
        const line: QuoteLine = {
            item_id: it._id,
            code: it.code,
            name: it.name,
            description: it.description,
            quantity: 1,
            price: it.price,
            iva: it.taxes?.iva ?? 0,
            descuento: "0",
            unidad_medida: it.unidad_medida,
        };
        setFormData((p) => ({ ...p, lines: [...p.lines, line] }));
        setShowProductPicker(false);
    };
    const removeLine = (idx: number) => setFormData((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }));
    const updateLine = (idx: number, patch: Partial<QuoteLine>) =>
        setFormData((p) => ({ ...p, lines: p.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));

    // IVA: solo dígitos, 1 decimal, máx 20
    const sanitizeIva = (v: string): number => {
        const cleaned = v.replace(/[^\d.]/g, "");
        const n = parseFloat(cleaned);
        if (Number.isNaN(n)) return 0;
        return Math.min(20, Math.round(n * 10) / 10);
    };

    const onPickClient = (c: IExternUser) => {
        setSelectedClient(c);
        setMainEmail(c.email ?? "");
        setFormData((p) => ({ ...p, client_id: c._id }));
        setShowClientPicker(false);
    };

    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

    const addExtraEmail = () => {
        const raw = extraEmailInput.trim().replace(/[,;]$/, "");
        if (!raw) return;
        if (!isValidEmail(raw)) {
            toast.error("Correo no válido");
            return;
        }
        const current = formData.extra_emails ?? [];
        if (current.includes(raw) || raw === mainEmail) {
            setExtraEmailInput("");
            return;
        }
        setFormData((p) => ({ ...p, extra_emails: [...current, raw] }));
        setExtraEmailInput("");
    };

    const removeExtraEmail = (email: string) =>
        setFormData((p) => ({ ...p, extra_emails: (p.extra_emails ?? []).filter((e) => e !== email) }));

    // ---- Guardar ----
    const submitQuote = async (sendEmail: boolean) => {
        setOpenSendMenu(false);
        if (!formData.client_id) {
            toast.error("Selecciona un cliente");
            return;
        }
        if (formData.lines.length === 0) {
            toast.error("Agrega al menos un ítem");
            return;
        }
        if (formData.lines.some((l) => !l.name.trim() || l.quantity <= 0 || l.price < 0)) {
            toast.error("Revisa nombre, cantidad (>0) y precio de cada ítem");
            return;
        }
        setLoading(true);
        try {
            // El correo principal editable y los destinatarios extra van en el payload.
            const payload = { ...formData, client_email: mainEmail.trim() || undefined, extra_emails: formData.extra_emails ?? [] };
            if (isEditMode && id) {
                await updateQuote(id, payload);
                toast.success("Cotización actualizada");
            } else {
                await createQuote({ ...payload, send_email: sendEmail, executed_by: user?.razon_social });
                toast.success(sendEmail ? "Cotización creada y enviada al cliente" : "Cotización creada");
            }
            clearDraft();
            navigate("/ventas/cotizaciones");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al guardar la cotización");
        } finally {
            setLoading(false);
        }
    };

    const requestClose = () => {
        if (loading) return;
        if (draftEnabled && isFormDirty(formData, { ...createEmptyForm(), valid_until: formData.valid_until })) {
            setShowUnsaved(true);
            return;
        }
        navigate("/ventas/cotizaciones");
    };

    const canSave = !loading && !!formData.client_id && formData.lines.length > 0;
    const docTitle = isEditMode ? "Editar cotización" : `Nueva cotización · ${new Date().toLocaleDateString("es-CO")}`;

    return (
        <main className="container-scroll">
            <div className="cot-page">
                {/* Barra superior: accesos directos a listado, clientes y productos */}
                <div className="cot-page-nav">
                    <button type="button" className="cot-nav-link" onClick={() => navigate("/ventas/cotizaciones")}>
                        <i className="ri-list-check-2" /> Ver cotizaciones creadas
                    </button>
                    <span className="cot-nav-sep" aria-hidden></span>
                    <button type="button" className="cot-nav-link" onClick={() => navigate(PATHS.CLIENTS)}>
                        <i className="ri-group-line" /> Clientes
                    </button>
                    <button type="button" className="cot-nav-link" onClick={() => navigate(PATHS.PRODUCTS_SERVICES)}>
                        <i className="ri-box-3-line" /> Productos / Servicios
                    </button>
                </div>

                {/* TOPBAR */}
                <div className="cot-topbar">
                    <div className="cot-topbar-brand">{user?.razon_social || "EMPRESA"}</div>
                    <div className="cot-title-input">{docTitle}</div>
                    <div className="cot-topbar-actions">
                        <ActionButtons canSave={canSave} loading={loading} isEdit={isEditMode} onSave={() => submitQuote(false)} onSaveSend={() => submitQuote(true)} openMenu={openSendMenu} setOpenMenu={setOpenSendMenu} menuUp={false} splitRef={splitRef} />
                    </div>
                </div>

                {/* BODY TOP: cliente + meta */}
                <div className="cot-body-top">
                    <div className="cot-client-panel">
                        {!selectedClient ? (
                            <button className="cot-client-empty" onClick={() => setShowClientPicker(true)} disabled={loading}>
                                <i className="ri-user-add-line cot-client-empty-icon" />
                                <h3>Seleccionar un cliente</h3>
                                <p>Busca o agrega un cliente para continuar</p>
                            </button>
                        ) : (
                            <div className="cot-client-selected">
                                <div className="cot-client-header-row">
                                    <span className="cot-client-name-title">{selectedClient.name}</span>
                                    <button className="cot-change-client-btn" title="Cambiar cliente" onClick={() => setShowClientPicker(true)} disabled={loading}>
                                        <i className="ri-refresh-line" />
                                    </button>
                                </div>
                                <ul className="cot-client-list">
                                    <li>
                                        <b>Documento:</b> {selectedClient.doc_number || "—"}
                                    </li>
                                    {selectedClient.phone && (
                                        <li>
                                            <b>Teléfono:</b> {selectedClient.phone}
                                        </li>
                                    )}
                                    <li className="cot-client-email-row">
                                        <b>Correo:</b>
                                        <input
                                            type="email"
                                            className="cot-email-input"
                                            placeholder="Correo de envío"
                                            value={mainEmail}
                                            onChange={(e) => setMainEmail(e.target.value)}
                                            disabled={loading}
                                        />
                                    </li>
                                </ul>

                                {/* Más destinatarios (CC) */}
                                <div className="cot-dest">
                                    <label className="cot-dest-lbl">Más destinatarios</label>
                                    <div className="cot-dest-input-row">
                                        <input
                                            type="email"
                                            className="cot-email-input"
                                            placeholder="Agregar correo y Enter"
                                            value={extraEmailInput}
                                            onChange={(e) => setExtraEmailInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === ",") {
                                                    e.preventDefault();
                                                    addExtraEmail();
                                                }
                                            }}
                                            disabled={loading}
                                        />
                                        <button type="button" className="cot-dest-add" onClick={addExtraEmail} disabled={loading} title="Agregar destinatario">
                                            <i className="ri-add-line" />
                                        </button>
                                    </div>
                                    {(formData.extra_emails ?? []).length > 0 && (
                                        <div className="cot-chips-wrap">
                                            {(formData.extra_emails ?? []).map((email) => (
                                                <span className="cot-chip" key={email}>
                                                    {email}
                                                    <button type="button" onClick={() => removeExtraEmail(email)} disabled={loading} aria-label={`Quitar ${email}`}>
                                                        ✕
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="cot-meta-panel">
                        <div className="cot-meta-grid">
                            <div className="cot-meta-field">
                                <span className="cot-meta-label">Fecha elaboración:</span>
                                <span className="cot-meta-val">{new Date().toLocaleDateString("es-CO")}</span>
                            </div>
                            <div className="cot-meta-field">
                                <span className="cot-meta-label">Forma de pago:</span>
                                <select className="cot-meta-select" value={formData.payment_form ?? "Contado"} onChange={(e) => setFormData((p) => ({ ...p, payment_form: e.target.value as QuotePaymentForm }))} disabled={loading}>
                                    <option value="Contado">Contado</option>
                                    <option value="Crédito">Crédito</option>
                                </select>
                            </div>
                            <div className="cot-meta-field">
                                <span className="cot-meta-label">Fecha vencimiento:</span>
                                <input className="cot-meta-date" type="date" value={formData.valid_until ?? ""} onChange={(e) => setFormData((p) => ({ ...p, valid_until: e.target.value }))} disabled={loading} />
                            </div>
                            <div className="cot-meta-field">
                                <span className="cot-meta-label">Medio de pago:</span>
                                <select className="cot-meta-select" value={formData.payment_method ?? "Efectivo"} onChange={(e) => setFormData((p) => ({ ...p, payment_method: e.target.value }))} disabled={loading}>
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Transferencia">Transferencia</option>
                                    <option value="Consignación">Consignación</option>
                                    <option value="Tarjeta">Tarjeta</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                        </div>
                        <div className="cot-valor-letras">{(totals.valor_letras || "M/CTE ******").toUpperCase()}</div>
                    </div>
                </div>

                {/* TABLA DE ÍTEMS */}
                <div className="cot-table-section">
                    <div className="cot-table-scroll led-editable-table">
                        <table className="cot-table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Detalle</th>
                                    <th>Cantidad</th>
                                    <th>Precio Unitario</th>
                                    <th>IVA (%)</th>
                                    <th>Valor Total</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={7} className="cot-add-cell">
                                        <button className="cot-add-item-btn" onClick={() => setShowProductPicker(true)} disabled={loading}>
                                            <i className="ri-add-line" /> Agregar Producto/Servicio
                                        </button>
                                    </td>
                                </tr>
                                {formData.lines.map((line, idx) => (
                                    <tr key={idx}>
                                        <td>{(line.code || "—").toUpperCase()}</td>
                                        <td className="cot-td-edit cot-td-edit--left">
                                            <FieldControl type="text" value={line.name} placeholder="Detalle" onChange={(e) => updateLine(idx, { name: e.target.value })} disabled={loading} />
                                        </td>
                                        <td className="cot-td-edit">
                                            <FieldControl type="number" min={0} value={line.quantity} onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })} disabled={loading} />
                                        </td>
                                        <td className="cot-td-edit">
                                            <FieldControl type="number" min={0} value={line.price} onChange={(e) => updateLine(idx, { price: parseFloat(e.target.value) || 0 })} disabled={loading} />
                                        </td>
                                        <td className="cot-td-edit">
                                            <FieldControl type="text" value={line.iva} onChange={(e) => updateLine(idx, { iva: sanitizeIva(e.target.value) })} disabled={loading} />
                                        </td>
                                        <td>{formatCOP(line.price * line.quantity)}</td>
                                        <td>
                                            <div className="cot-row-actions">
                                                <button className="cot-icon-btn cot-icon-btn--del" title="Eliminar" onClick={() => removeLine(idx)} disabled={loading}>
                                                    <i className="ri-close-line" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="cot-table-meta">
                        Total Items: <strong>{formData.lines.length}</strong>
                    </div>
                </div>

                {/* BARRA DE TOTALES (6) */}
                <div className="cot-totals-bar">
                    <div className="cot-total-item">
                        <span className="cot-total-label">Valor bruto</span>
                        <span className="cot-total-value">{formatCOP(totals.bruto)}</span>
                    </div>
                    <div className="cot-total-item">
                        <span className="cot-total-label">Descuentos</span>
                        <span className="cot-total-value">{formatCOP(totals.descuento)}</span>
                    </div>
                    <div className="cot-total-item">
                        <span className="cot-total-label">Subtotal</span>
                        <span className="cot-total-value">{formatCOP(totals.subtotal)}</span>
                    </div>
                    <div className="cot-total-item">
                        <span className="cot-total-label">Impuestos</span>
                        <span className="cot-total-value">{formatCOP(totals.iva)}</span>
                    </div>
                    <div className="cot-total-item">
                        <span className="cot-total-label">Retenciones</span>
                        <span className="cot-total-value cot-reten-wrap">
                            %
                            <input
                                className="cot-reten-inp"
                                type="text"
                                value={formData.retenciones ?? 0}
                                onChange={(e) => setFormData((p) => ({ ...p, retenciones: sanitizeIva(e.target.value) }))}
                                disabled={loading}
                            />
                        </span>
                    </div>
                    <div className="cot-total-item cot-total-item--grand">
                        <span className="cot-total-label">Total</span>
                        <span className="cot-total-value cot-grand-total">{formatCOP(totals.total)}</span>
                    </div>
                </div>

                {/* OBSERVACIONES (colapsable) */}
                {showObs && (
                    <div className="cot-obs-panel">
                        <textarea
                            placeholder="Escribe las observaciones de la cotización..."
                            value={formData.notes ?? ""}
                            onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                            disabled={loading}
                        />
                    </div>
                )}

                {/* FOOTER */}
                <div className="cot-footer-bar">
                    <div className="cot-footer-left">
                        <button className="cot-btn-ghost" onClick={() => setShowObs((s) => !s)} disabled={loading}>
                            <i className="ri-chat-3-line" /> Observaciones
                        </button>
                        <div className="cot-footer-total-display">
                            <div className="cot-dollar-badge">$</div>
                            <div>
                                <div className="cot-footer-total-lbl">Total de la cotización:</div>
                                <div className="cot-footer-total-num">{formatCOP(totals.total)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="cot-footer-right">
                        <button className="cot-btn-ghost" onClick={requestClose} disabled={loading}>
                            Cancelar
                        </button>
                        <ActionButtons canSave={canSave} loading={loading} isEdit={isEditMode} onSave={() => submitQuote(false)} onSaveSend={() => submitQuote(true)} openMenu={openSendMenu} setOpenMenu={setOpenSendMenu} menuUp splitRef={splitRef} />
                    </div>
                </div>
            </div>

            <ClientPicker isOpen={showClientPicker} onClose={() => setShowClientPicker(false)} onPick={onPickClient} />
            <ProductPicker isOpen={showProductPicker} onClose={() => setShowProductPicker(false)} onPick={addLineFromItem} />
            <UnsavedChangesModal
                isOpen={showUnsaved}
                onSaveDraft={() => {
                    saveDraft(formData);
                    setShowUnsaved(false);
                    navigate("/ventas/cotizaciones");
                }}
                onDiscard={() => {
                    clearDraft();
                    setShowUnsaved(false);
                    navigate("/ventas/cotizaciones");
                }}
                onKeepEditing={() => setShowUnsaved(false)}
            />
        </main>
    );
};

/** Botones de acción reutilizados en topbar y footer: Guardar (solo guardar) + split "Guardar y enviar". */
interface ActionButtonsProps {
    canSave: boolean;
    loading: boolean;
    isEdit: boolean;
    onSave: () => void;
    onSaveSend: () => void;
    openMenu: boolean;
    setOpenMenu: (v: boolean) => void;
    menuUp: boolean;
    splitRef: React.RefObject<HTMLDivElement | null>;
}
const ActionButtons: React.FC<ActionButtonsProps> = ({ canSave, loading, isEdit, onSave, onSaveSend, openMenu, setOpenMenu, menuUp, splitRef }) => (
    <div className="cot-action-btns">
        <button className="cot-btn-outline" onClick={onSave} disabled={!canSave}>
            <i className="ri-save-line" /> {loading ? "Guardando..." : "Guardar"}
        </button>
        {!isEdit && (
            <div className="cot-split-btn-wrap" ref={splitRef}>
                <div className="cot-split-btn">
                    <button className="cot-btn-primary" onClick={onSaveSend} disabled={!canSave}>
                        <i className="ri-mail-send-line" /> Guardar y enviar
                    </button>
                    <button className="cot-btn-primary cot-split-arrow" onClick={() => setOpenMenu(!openMenu)} disabled={!canSave}>
                        <i className="ri-arrow-down-s-line" />
                    </button>
                </div>
                {openMenu && (
                    <div className={`cot-dropdown-menu${menuUp ? " cot-dropdown-menu--up" : ""}`}>
                        <button onClick={onSave}>
                            <i className="ri-save-line" /> Solo guardar
                        </button>
                    </div>
                )}
            </div>
        )}
    </div>
);

export default QuoteEditor;
