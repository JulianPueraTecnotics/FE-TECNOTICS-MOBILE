import { useCallback, useEffect, useMemo, useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../ledger/page/Accounting.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getConcPendientes, getConcDocumentos, aplicarConc, aplicarConcMultiple, aplicarConcMultipleCompras, aplicarConcLote, aplicarConcTodas, type ConcMovimiento, type ConcDocumento } from "../reconciliation.service";
import "../../purchases/components/PurchaseModals.css";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { ListPageShell, ListPageContainer, ListPageHeader, useConfirm, AppModal, FilterField, FieldControl } from "../../../components/design-system";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const fdate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

/**
 * Conciliación ASISTIDA del banco: lista los movimientos del extracto que están en el
 * libro banco (contra la cuenta puente) y permite aplicarlos a clientes/proveedores.
 * Caso clave: seleccionar VARIOS movimientos del mismo cliente y aplicarlos a UNA factura.
 */
const BankConciliationAssistPage: React.FC = () => {
    const { confirm } = useConfirm();
    const [movs, setMovs] = useState<ConcMovimiento[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    // Filtro: mostrar solo los movimientos que el sistema ya resolvió (con factura/compra sugerida).
    const [soloSugeridas, setSoloSugeridas] = useState(false);
    // Sub-filtro por tercero (proveedor/cliente) dentro de "solo con sugerencia".
    const [tercero, setTercero] = useState("");
    const [terceros, setTerceros] = useState<{ nombre: string; cantidad: number }[]>([]);

    // Selección de movimientos (para sumar varios a una factura).
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Modal de aplicación.
    const [applyOpen, setApplyOpen] = useState(false);
    const [tipo, setTipo] = useState<"cliente" | "proveedor">("cliente");
    const [docBusqueda, setDocBusqueda] = useState("");
    const [documentos, setDocumentos] = useState<ConcDocumento[]>([]);
    const [docId, setDocId] = useState("");
    const [applying, setApplying] = useState(false);
    // Modo "varias facturas": reparte la suma de los pagos en varias facturas seleccionadas.
    const [multiFactura, setMultiFactura] = useState(false);
    const [docIds, setDocIds] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await getConcPendientes({ search: debounced.trim(), page, pageSize: 30, soloSugeridas, tercero });
            setMovs(r.movimientos);
            setTotalPages(r.pagination.totalPages);
            setTotal(r.pagination.total);
            // La lista completa de terceros viene cuando NO hay tercero filtrado (evita reducir el selector).
            if (soloSugeridas && !tercero) setTerceros(r.terceros ?? []);
            if (!soloSugeridas) { setTerceros([]); }
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar los movimientos");
        } finally {
            setLoading(false);
        }
    }, [debounced, page, soloSugeridas, tercero]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [debounced, soloSugeridas, tercero]);
    // Al apagar "solo con sugerencia", limpia el sub-filtro de tercero.
    useEffect(() => { if (!soloSugeridas) setTercero(""); }, [soloSugeridas]);

    const toggle = (id: string) => setSelected((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });

    // ¿Están todos los movimientos de la página seleccionados?
    const allSelected = movs.length > 0 && movs.every((m) => selected.has(m.asiento_id));
    /** Marca/desmarca TODOS los movimientos de la página actual. */
    const toggleAll = () => setSelected((prev) => {
        const n = new Set(prev);
        if (allSelected) movs.forEach((m) => n.delete(m.asiento_id));
        else movs.forEach((m) => n.add(m.asiento_id));
        return n;
    });

    const seleccionados = useMemo(() => movs.filter((m) => selected.has(m.asiento_id)), [movs, selected]);
    const sumaSel = useMemo(() => seleccionados.reduce((s, m) => s + m.valor, 0), [seleccionados]);

    // Movimientos (de la página) que ya tienen una sugerencia única para conciliar de un golpe:
    // factura sugerida del cliente, o compra sugerida con un solo candidato.
    const conSugerencia = useMemo(() => movs.filter((m) => m.factura_sugerida || (m.compra_sugerida && m.compra_sugerida.candidatos === 1)), [movs]);
    // ¿El tercero filtrado es un PROVEEDOR (egresos con compra sugerida)? Para ofrecer "aplicar a su cartera".
    const terceroEsProveedor = useMemo(() => !!tercero && movs.length > 0 && movs.some((m) => m.compra_sugerida) && !movs.some((m) => m.factura_sugerida || m.cliente_sugerido), [tercero, movs]);
    const [bulkLoading, setBulkLoading] = useState(false);

    /** Concilia EN LOTE solo los movimientos con sugerencia DE LA PÁGINA actual. */
    const conciliarTodasSugeridas = async () => {
        if (!conSugerencia.length) { errorToast("No hay movimientos con sugerencia en esta página"); return; }
        const pares = conSugerencia.map((m) => m.factura_sugerida
            ? { asiento_id: m.asiento_id, doc_tipo: "factura" as const, doc_id: m.factura_sugerida.factura_id }
            : { asiento_id: m.asiento_id, doc_tipo: "compra" as const, doc_id: m.compra_sugerida!.compra_id });
        setBulkLoading(true);
        try {
            const r = await aplicarConcLote(pares);
            if (r.errores.length) errorToast(r.message); else successToast(r.message);
            setSelected(new Set());
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudieron conciliar");
        } finally {
            setBulkLoading(false);
        }
    };

    /**
     * Concilia TODAS las sugeridas de TODAS las páginas que cumplen el filtro actual
     * (search + tercero). Usado cuando "Solo con sugerencia" está activo: un clic concilia
     * las 137 de KLEYMAN, no solo las 30 visibles.
     */
    const conciliarTodasLasPaginas = async () => {
        const quien = tercero ? `de ${tercero}` : "con sugerencia";
        if (!(await confirm(`Se conciliarán los movimientos ${quien} con su factura/compra sugerida.\n\nSolo se concilian las coincidencias SEGURAS (facturas por NIT y compras de valor ÚNICO). Las ambiguas (varias compras del mismo valor) se omiten para que las revises a mano.\n\n¿Continuar?`))) return;
        setBulkLoading(true);
        try {
            const r = await aplicarConcTodas({ search: debounced.trim() || undefined, tercero: tercero || undefined });
            if (r.errores.length) errorToast(r.message); else successToast(r.message);
            setSelected(new Set());
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudieron conciliar");
        } finally {
            setBulkLoading(false);
        }
    };

    /**
     * Aplica TODOS los pagos del proveedor filtrado a SU cartera de compras, de la más antigua a
     * la más nueva (paga las que alcance, la última parcial). Útil para proveedores con
     * transferencias de valor repetido (BUÑUELOS, RAMON): el proveedor es seguro, el valor no
     * identifica la factura, así que se abona a la cartera por antigüedad.
     */
    const aplicarPagosACartera = async () => {
        if (!tercero) { errorToast("Primero elige un proveedor en el filtro"); return; }
        if (!(await confirm(`Se tomarán TODOS los ${total} pago(s) de ${tercero} y se aplicarán a sus compras pendientes, de la más antigua a la más nueva. ¿Continuar?`))) return;
        setBulkLoading(true);
        try {
            // Traer los asientoIds de todas las páginas del proveedor filtrado.
            const r = await getConcPendientes({ search: debounced.trim(), soloSugeridas: true, tercero, page: 1, pageSize: 2000 });
            const asientoIds = r.movimientos.filter((m) => m.compra_sugerida).map((m) => m.asiento_id);
            const supplierDoc = r.movimientos.find((m) => m.compra_sugerida)?.compra_sugerida?.supplier_doc;
            if (!asientoIds.length || !supplierDoc) { errorToast("No hay pagos de proveedor para aplicar"); setBulkLoading(false); return; }
            const res = await aplicarConcMultipleCompras(asientoIds, supplierDoc);
            successToast(res.message);
            setSelected(new Set());
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo aplicar a la cartera");
        } finally {
            setBulkLoading(false);
        }
    };

    /** Abre el modal para aplicar la selección; precarga el cliente sugerido si todos coinciden. */
    const openApply = () => {
        if (!seleccionados.length) { errorToast("Selecciona al menos un movimiento"); return; }
        const cli = seleccionados[0].cliente_sugerido;
        const todosMismo = cli && seleccionados.every((m) => m.cliente_sugerido?.doc_number === cli.doc_number);
        const esIngreso = sumaSel >= 0;
        setTipo(esIngreso ? "cliente" : "proveedor");
        setDocBusqueda(todosMismo ? cli!.doc_number : "");
        setDocumentos([]);
        setDocId("");
        setDocIds(new Set());
        // Si son varios pagos de un mismo cliente, por defecto activa el reparto en varias facturas.
        setMultiFactura(esIngreso && !!todosMismo && seleccionados.length > 1);
        setApplyOpen(true);
        if (todosMismo) void buscarDocs(cli!.doc_number, "cliente");
    };

    const buscarDocs = async (doc: string, t: "cliente" | "proveedor") => {
        if (!doc.trim()) { setDocumentos([]); return; }
        try {
            const r = await getConcDocumentos(doc.trim(), t);
            setDocumentos(r.documentos);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al buscar documentos");
        }
    };

    /** Suma del saldo de las facturas marcadas en modo multi (para guiar al usuario). */
    const saldoFacturasSel = useMemo(() => documentos.filter((d) => docIds.has(d.id)).reduce((s, d) => s + d.saldo, 0), [documentos, docIds]);
    // ¿Están todas las facturas listadas marcadas? (para el "seleccionar todas" del modal)
    const allDocsSelected = documentos.length > 0 && documentos.every((d) => docIds.has(d.id));
    const toggleAllDocs = () => setDocIds(allDocsSelected ? new Set() : new Set(documentos.map((d) => d.id)));

    const aplicar = async () => {
        const ids = seleccionados.map((m) => m.asiento_id);
        setApplying(true);
        try {
            if (multiFactura) {
                const facturaIds = [...docIds];
                if (!facturaIds.length) { errorToast("Marca al menos una factura"); setApplying(false); return; }
                const r = await aplicarConcMultiple(ids, facturaIds);
                successToast(r.message);
            } else {
                if (!docId) { errorToast("Elige la factura/compra a la que corresponde"); setApplying(false); return; }
                const docTipo = tipo === "cliente" ? "factura" : "compra";
                // Si la factura elegida ES la sugerida con retención, pásala para saldarla completa.
                const sug = seleccionados.length === 1 ? seleccionados[0].factura_sugerida : null;
                const ret = docTipo === "factura" && sug?.motivo === "retencion" && sug.factura_id === docId && sug.retencion
                    ? { valor: sug.retencion.valor, cuenta: sug.retencion.cuenta, pct: sug.retencion.pct }
                    : null;
                const r = await aplicarConc(ids, docTipo, docId, ret);
                successToast(r.message);
            }
            setApplyOpen(false);
            setSelected(new Set());
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo conciliar");
        } finally {
            setApplying(false);
        }
    };

    /** Concilia en 1 clic el pago contra la factura sugerida (incluye la retención si la hay). */
    const conciliarFacturaSugerida = async (m: ConcMovimiento) => {
        const fs = m.factura_sugerida;
        if (!fs) return;
        try {
            const ret = fs.motivo === "retencion" && fs.retencion ? { valor: fs.retencion.valor, cuenta: fs.retencion.cuenta, pct: fs.retencion.pct } : null;
            const r = await aplicarConc([m.asiento_id], "factura", fs.factura_id, ret);
            successToast(r.message);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo conciliar");
        }
    };

    /** Como en Recaudos: filtra todos los movimientos del MISMO concepto (descripción). */
    const verIguales = (m: ConcMovimiento) => setSearch(m.descripcion);

    /**
     * Abre el modal para elegir la compra de un proveedor (cuando la sugerencia es ambigua:
     * varias compras del mismo valor). Precarga el NIT del proveedor y lista sus compras.
     */
    const aplicarAProveedor = async (m: ConcMovimiento) => {
        if (!m.compra_sugerida) return;
        setSelected(new Set([m.asiento_id]));
        setTipo("proveedor");
        setMultiFactura(false);
        setDocIds(new Set());
        setDocId(m.compra_sugerida.compra_id); // preselecciona la sugerida (la de fecha más cercana)
        const doc = m.compra_sugerida.supplier_doc ?? "";
        setDocBusqueda(doc);
        setDocumentos([]);
        setApplyOpen(true);
        if (doc) await buscarDocs(doc, "proveedor");
    };

    /** Concilia UN movimiento contra su compra sugerida. Si es ambigua, abre el selector para elegir. */
    const conciliarSugerida = async (m: ConcMovimiento) => {
        if (!m.compra_sugerida) return;
        // Ambigua (varias compras del mismo valor): no concilies a ciegas, deja elegir al usuario.
        if (m.compra_sugerida.candidatos > 1) { await aplicarAProveedor(m); return; }
        try {
            const r = await aplicarConc([m.asiento_id], "compra", m.compra_sugerida.compra_id);
            successToast(r.message);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo conciliar");
        }
    };

    /**
     * Abre el modal para aplicar UN pago de cliente a su factura: selecciona el movimiento,
     * precarga el cliente sugerido y trae sus facturas pendientes para elegir cuál pagar.
     */
    const aplicarACliente = async (m: ConcMovimiento) => {
        setSelected(new Set([m.asiento_id]));
        setTipo("cliente");
        setMultiFactura(false);
        setDocIds(new Set());
        setDocId(m.factura_sugerida?.factura_id ?? ""); // preselecciona la sugerida si la hay
        const doc = m.cliente_sugerido?.doc_number ?? "";
        setDocBusqueda(doc);
        setDocumentos([]);
        setApplyOpen(true);
        if (doc) await buscarDocs(doc, "cliente");
    };

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <ListPageHeader
                    className="purchases-header"
                    title="Conciliar movimientos del banco"
                    subtitle="Asigna cada movimiento del extracto a su cliente o proveedor. Puedes seleccionar varios pagos que juntos cubren una factura."
                    actions={
                        <div className="purchases-actions">
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input type="text" placeholder="Buscar (ej. PAGO INTERBANC, 24 H SERVICES)…" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <button className={soloSugeridas ? "btn-primary" : "btn-secondary"} onClick={() => setSoloSugeridas((v) => !v)} title="Mostrar solo los movimientos que ya tienen una factura/compra sugerida para conciliar">
                            <i className="ri-filter-3-line" /> {soloSugeridas ? "Solo con sugerencia ✓" : "Solo con sugerencia"}
                        </button>
                        {soloSugeridas && terceros.length > 0 && (
                            <select value={tercero} onChange={(e) => setTercero(e.target.value)} title="Filtrar por proveedor/cliente" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--card-bg)", maxWidth: 260 }}>
                                <option value="">Todos los terceros ({terceros.reduce((s, t) => s + t.cantidad, 0)})</option>
                                {terceros.map((t) => <option key={t.nombre} value={t.nombre}>{t.nombre} ({t.cantidad})</option>)}
                            </select>
                        )}
                        {soloSugeridas && total > 0 ? (
                            <button className="btn-primary" onClick={conciliarTodasLasPaginas} disabled={bulkLoading} title="Concilia TODAS las páginas que cumplen el filtro, no solo la visible">
                                <i className="ri-check-double-line" /> {bulkLoading ? "Conciliando…" : `Conciliar TODAS (${total})`}
                            </button>
                        ) : conSugerencia.length > 0 ? (
                            <button className="btn-primary" onClick={conciliarTodasSugeridas} disabled={bulkLoading} title="Concilia cada movimiento de esta página con su factura/compra sugerida">
                                <i className="ri-check-double-line" /> {bulkLoading ? "Conciliando…" : `Conciliar ${conSugerencia.length} sugerida(s)`}
                            </button>
                        ) : null}
                        {terceroEsProveedor && (
                            <button className="btn-primary" onClick={aplicarPagosACartera} disabled={bulkLoading} title={`Aplica todos los pagos de ${tercero} a sus compras pendientes, de la más antigua a la más nueva`}>
                                <i className="ri-inbox-archive-line" /> {bulkLoading ? "Aplicando…" : `Aplicar ${total} pago(s) a cartera`}
                            </button>
                        )}
                        </div>
                    }
                />

                <div className="purchases-summary" style={{ flexWrap: "wrap", gap: 18 }}>
                    <span><strong>{total}</strong> movimiento(s) por conciliar</span>
                    {seleccionados.length > 0 && <span style={{ color: "var(--accent-teal)" }}><strong>{seleccionados.length}</strong> seleccionado(s) · suma <strong>{money(sumaSel)}</strong></span>}
                </div>

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando movimientos…</div>
                ) : movs.length === 0 ? (
                    <div className="purchases-empty"><i className="ri-check-double-line"></i><p>No hay movimientos por conciliar. ¡Todo al día!</p></div>
                ) : (
                    <>
                        <div className="purchases-table-container">
                            <table className="purchases-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} title={allSelected ? "Quitar selección" : "Seleccionar todos"} /></th>
                                        <th>Fecha</th>
                                        <th>Descripción</th>
                                        <th style={{ textAlign: "right" }}>Valor</th>
                                        <th>¿Corresponde a?</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movs.map((m) => (
                                        <tr key={m.asiento_id} style={selected.has(m.asiento_id) ? { background: "rgba(31,157,143,.08)" } : undefined}>
                                            <td><input type="checkbox" checked={selected.has(m.asiento_id)} onChange={() => toggle(m.asiento_id)} /></td>
                                            <td>{fdate(m.fecha)}</td>
                                            <td>
                                                {m.descripcion}{m.es_pago_cliente && <span className="status-badge status-paid" style={{ marginLeft: 6, fontSize: ".7rem" }}>pago cliente</span>}
                                                <button className="btn-action" title="Ver todos los movimientos de este concepto" onClick={() => verIguales(m)} style={{ marginLeft: 6, fontSize: ".72rem", padding: "1px 6px" }}>
                                                    <i className="ri-filter-line" /> iguales
                                                </button>
                                            </td>
                                            <td style={{ textAlign: "right", color: m.valor < 0 ? "var(--tertiary-color)" : undefined }}>{money(m.valor)}</td>
                                            <td>
                                                {m.factura_sugerida ? (
                                                    <span title={m.factura_sugerida.motivo === "retencion"
                                                        ? `Saldo ${money(m.factura_sugerida.saldo)} = pago + retención del ${m.factura_sugerida.retencion?.pct}%`
                                                        : "Factura con saldo igual al pago"}>
                                                        <i className="ri-bill-line" /> {m.factura_sugerida.numero} · {m.factura_sugerida.cliente.slice(0, 16)}
                                                        {m.factura_sugerida.motivo === "retencion" ? (
                                                            <span className="status-badge" style={{ marginLeft: 6, fontSize: ".7rem", background: "rgba(234,179,8,.15)", color: "#b45309" }}>
                                                                ret. {m.factura_sugerida.retencion?.pct}% · {money(m.factura_sugerida.retencion?.valor || 0)}
                                                            </span>
                                                        ) : (
                                                            <span className="status-badge status-paid" style={{ marginLeft: 6, fontSize: ".7rem" }}>exacta</span>
                                                        )}
                                                    </span>
                                                ) : m.cliente_sugerido ? (
                                                    <span title="Cliente identificado por la referencia"><i className="ri-user-line" /> {m.cliente_sugerido.nombre}</span>
                                                ) : m.compra_sugerida ? (
                                                    (() => {
                                                        const coincide = Math.abs(Math.abs(m.valor) - m.compra_sugerida.saldo) < 1;
                                                        return (
                                                            <span title={`Pago ${money(Math.abs(m.valor))} vs saldo compra ${money(m.compra_sugerida.saldo)} · ${m.compra_sugerida.candidatos} candidato(s) · a ${m.compra_sugerida.dias} día(s)`}>
                                                                <i className="ri-shopping-bag-3-line" /> {m.compra_sugerida.numero} · {m.compra_sugerida.proveedor.slice(0, 18)}
                                                                <strong style={{ marginLeft: 6, color: coincide ? "var(--accent-teal)" : "var(--tertiary-color)" }}>{money(m.compra_sugerida.saldo)}</strong>
                                                                {!coincide && <i className="ri-error-warning-line" title="El saldo de la compra NO coincide con el pago" style={{ color: "var(--tertiary-color)", marginLeft: 3 }} />}
                                                                <small style={{ marginLeft: 6, color: m.compra_sugerida.candidatos === 1 ? "var(--accent-teal)" : "#b45309" }}>
                                                                    {m.compra_sugerida.candidatos === 1 ? "única" : `${m.compra_sugerida.candidatos} opc.`} · {m.compra_sugerida.dias}d
                                                                </small>
                                                            </span>
                                                        );
                                                    })()
                                                ) : <span className="dian-subtle">—</span>}
                                            </td>
                                            <td>
                                                {m.factura_sugerida ? (
                                                    <div style={{ display: "flex", gap: 4 }}>
                                                        <button className="btn-action" title={m.factura_sugerida.motivo === "retencion" ? "Conciliar y saldar la factura (pago + retención)" : "Conciliar con la factura sugerida"} onClick={() => conciliarFacturaSugerida(m)}>
                                                            <i className="ri-check-line" /> Conciliar
                                                        </button>
                                                        <button className="btn-action" title="Elegir otra factura" onClick={() => aplicarACliente(m)} style={{ padding: "1px 6px" }}>
                                                            <i className="ri-more-line" />
                                                        </button>
                                                    </div>
                                                ) : m.cliente_sugerido ? (
                                                    <button className="btn-action" title="Aplicar este pago a una factura del cliente" onClick={() => aplicarACliente(m)}>
                                                        <i className="ri-links-line" /> Aplicar a factura
                                                    </button>
                                                ) : m.compra_sugerida ? (
                                                    m.compra_sugerida.candidatos > 1 ? (
                                                        <button className="btn-action" title={`Hay ${m.compra_sugerida.candidatos} compras de este valor: elige la correcta`} onClick={() => aplicarAProveedor(m)}>
                                                            <i className="ri-search-line" /> Elegir compra
                                                        </button>
                                                    ) : (
                                                        <button className="btn-action" title="Conciliar con la compra sugerida (valor único)" onClick={() => conciliarSugerida(m)}>
                                                            <i className="ri-check-line" /> Conciliar
                                                        </button>
                                                    )
                                                ) : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination pagination--bottom">
                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</button>
                                <span className="pagination__info">Página {page} de {totalPages}</span>
                                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Siguiente</button>
                            </div>
                        )}
                    </>
                )}
            </ListPageContainer>

            {/* Barra de acción flotante con la selección */}
            {seleccionados.length > 0 && (
                <div className="treasury-actionbar">
                    <div className="treasury-actionbar__info">
                        <strong>{seleccionados.length}</strong> movimiento(s) · Suma: <strong>{money(sumaSel)}</strong>
                    </div>
                    <div className="treasury-actionbar__controls">
                        <button className="btn-secondary" onClick={() => setSelected(new Set())}>Limpiar</button>
                        <button className="btn-primary" onClick={openApply}><i className="ri-links-line" /> Aplicar a factura/compra</button>
                    </div>
                </div>
            )}

            {/* Modal de aplicación */}
            {applyOpen && (
                <AppModal
                    title={`Aplicar ${seleccionados.length} movimiento(s) · ${money(sumaSel)}`}
                    onClose={() => setApplyOpen(false)}
                    closeDisabled={applying}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setApplyOpen(false)} disabled={applying}>Cancelar</button>
                            <button type="button" className="export-submit" onClick={aplicar} disabled={applying || (multiFactura ? docIds.size === 0 : !docId)}>{applying ? "Aplicando…" : multiFactura ? `Repartir en ${docIds.size} factura(s)` : "Conciliar y abonar"}</button>
                        </>
                    }
                >
                            <div className="led-form-grid">
                                <FilterField label="Tipo" htmlFor="bca-tipo" icon="ri-exchange-line">
                                    <FieldControl as="select" id="bca-tipo" value={tipo} onChange={(e) => { setTipo(e.target.value as "cliente" | "proveedor"); setDocumentos([]); setDocId(""); }}>
                                        <option value="cliente">Cliente (recaudo de venta)</option>
                                        <option value="proveedor">Proveedor (pago de compra)</option>
                                    </FieldControl>
                                </FilterField>
                                <FilterField label={`NIT / documento del ${tipo}`} htmlFor="bca-doc" icon="ri-id-card-line">
                                    <FieldControl id="bca-doc" value={docBusqueda} onChange={(e) => setDocBusqueda(e.target.value)} onBlur={() => buscarDocs(docBusqueda, tipo)} placeholder="Ej. 901105552" />
                                </FilterField>
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                                <button className="btn-secondary" onClick={() => buscarDocs(docBusqueda, tipo)}><i className="ri-search-line" /> Buscar facturas/compras pendientes</button>
                                {tipo === "cliente" && (
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".85rem", cursor: "pointer" }} title="Reparte la suma de los pagos en varias facturas (de la más antigua a la más nueva)">
                                        <input type="checkbox" checked={multiFactura} onChange={(e) => { setMultiFactura(e.target.checked); setDocId(""); setDocIds(new Set()); }} />
                                        Repartir en varias facturas
                                    </label>
                                )}
                            </div>
                            {documentos.length === 0 ? (
                                <p className="pm-hint">Escribe el NIT y busca para ver las {tipo === "cliente" ? "facturas" : "compras"} pendientes.</p>
                            ) : (
                                <table className="acc-table">
                                    <thead><tr>
                                        <th>{multiFactura && <input type="checkbox" checked={allDocsSelected} onChange={toggleAllDocs} title={allDocsSelected ? "Quitar selección" : "Seleccionar todas"} />}</th>
                                        <th>Documento</th><th style={{ textAlign: "right" }}>Saldo</th>
                                    </tr></thead>
                                    <tbody>
                                        {documentos.map((d) => (multiFactura ? (
                                            <tr key={d.id} onClick={() => setDocIds((prev) => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} style={{ cursor: "pointer", background: docIds.has(d.id) ? "rgba(31,157,143,.12)" : undefined }}>
                                                <td><input type="checkbox" checked={docIds.has(d.id)} readOnly /></td>
                                                <td>{d.numero}</td>
                                                <td style={{ textAlign: "right" }}>{money(d.saldo)}</td>
                                            </tr>
                                        ) : (
                                            <tr key={d.id} onClick={() => setDocId(d.id)} style={{ cursor: "pointer", background: docId === d.id ? "rgba(31,157,143,.12)" : undefined }}>
                                                <td><input type="radio" checked={docId === d.id} onChange={() => setDocId(d.id)} /></td>
                                                <td>{d.numero}</td>
                                                <td style={{ textAlign: "right" }}>{money(d.saldo)}</td>
                                            </tr>
                                        )))}
                                    </tbody>
                                </table>
                            )}
                            {multiFactura ? (
                                <p className="pm-hint">
                                    Se repartirán <strong>{money(sumaSel)}</strong> entre las {docIds.size} factura(s) marcada(s) (saldo total {money(saldoFacturasSel)}), de la más antigua a la más nueva. La última queda como abono parcial si sobra.
                                    {sumaSel > saldoFacturasSel + 1 && <span style={{ color: "#b45309" }}> Ojo: el pago supera el saldo seleccionado en {money(sumaSel - saldoFacturasSel)}.</span>}
                                </p>
                            ) : (
                                <p className="pm-hint">Se reclasificará el banco a la cartera del {tipo} y se abonará el documento por {money(sumaSel)}. El banco no se duplica.</p>
                            )}
                </AppModal>
            )}
        </ListPageShell>
    );
};

export default BankConciliationAssistPage;
