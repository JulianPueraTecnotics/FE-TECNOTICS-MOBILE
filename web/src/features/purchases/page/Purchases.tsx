import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Purchases.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getPurchases, deletePurchase } from "../purchases.service";
import type { Purchase, PurchaseKind } from "../purchases.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import ImportModal from "../components/ImportModal";
import RetentionModal from "../components/RetentionModal";

interface Props {
    kind: PurchaseKind;
}

const DOC_LABELS: Record<string, string> = { "01": "Factura", "02": "Nota Débito", "03": "Nota Crédito", "91": "Nota Crédito", "92": "Nota Débito", "11": "Doc. Soporte" };

const formatCOP = (n: number, currency = "COP") =>
    (n || 0).toLocaleString("es-CO", { style: "currency", currency: currency || "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

const PurchasesPage: React.FC<Props> = ({ kind }) => {
    const isExpense = kind === "expense";
    const title = isExpense ? "Gastos" : "Compras";
    const subtitle = isExpense ? "Importa y administra tus comprobantes de gasto" : "Importa y administra tus facturas de compra de proveedores";

    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const [rows, setRows] = useState<Purchase[]>([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(pageFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);

    const [importOpen, setImportOpen] = useState(false);
    const [retencionOf, setRetencionOf] = useState<Purchase | null>(null);
    const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Tiempo real: solo refresca si el cambio es de este tipo (compras vs gastos).
    useRealtime(RealtimeEvents.PURCHASE_CHANGED, (payload) => {
        const item = payload.item as Purchase | undefined;
        // deleted no trae item: lo intentamos quitar siempre (si no está, no pasa nada).
        if (payload.action === "deleted") {
            setRows((prev) => prev.filter((r) => r._id !== payload.id));
            return;
        }
        if (item && item.kind !== kind) return; // pertenece al otro módulo
        setRows((prev) => applyRealtimeChange(prev, payload));
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getPurchases(kind, page, 20, debounced.trim());
            setRows(res.purchases);
            setTotalAmount(res.total_amount);
            setTotalPages(res.pagination.totalPages);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar los documentos");
        } finally {
            setLoading(false);
        }
    }, [kind, page, debounced, refreshKey]);

    useEffect(() => {
        load();
    }, [load]);

    const handlePageChange = (next: number) => {
        const safe = Math.max(1, Math.min(totalPages, next));
        setPage(safe);
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set("page", String(safe));
            return p;
        });
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deletePurchase(toDelete.id);
            successToast("Documento eliminado");
            if (rows.length === 1 && page > 1) handlePageChange(page - 1);
            else setRefreshKey((k) => k + 1);
            setToDelete(null);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>{title}</h1>
                        <p>{subtitle}</p>
                    </div>
                    <div className="purchases-actions">
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input type="text" placeholder="Buscar proveedor, NIT, número..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <button className="btn-primary" onClick={() => setImportOpen(true)}>
                            <i className="ri-upload-cloud-2-line"></i> Importar XML / ZIP
                        </button>
                    </div>
                </div>

                {!loading && rows.length > 0 && (
                    <div className="purchases-summary">
                        <span>Total {isExpense ? "gastos" : "compras"} (esta vista):</span>
                        <strong>{formatCOP(totalAmount)}</strong>
                    </div>
                )}

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando documentos...</div>
                ) : rows.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-inbox-archive-line"></i>
                        <p>No hay {isExpense ? "gastos" : "compras"} importados todavía.</p>
                        <button className="btn-primary" onClick={() => setImportOpen(true)}>
                            <i className="ri-upload-cloud-2-line"></i> Importar XML / ZIP
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="purchases-table-container">
                            <table className="purchases-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Número</th>
                                        <th>Proveedor</th>
                                        <th>NIT</th>
                                        <th>Fecha</th>
                                        <th>Total</th>
                                        <th>Origen</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r._id}>
                                            <td data-label="Tipo">{DOC_LABELS[r.document_type_code ?? ""] ?? "Documento"}</td>
                                            <td data-label="Número" className="document-number">{`${r.prefix ?? ""}${r.number ?? ""}` || "—"}</td>
                                            <td data-label="Proveedor">{r.supplier_name}</td>
                                            <td data-label="NIT">{r.supplier_doc}</td>
                                            <td data-label="Fecha">{formatDate(r.issue_date)}</td>
                                            <td data-label="Total" className="document-total">{formatCOP(r.total, r.currency)}</td>
                                            <td data-label="Origen">
                                                <span className={`status-badge ${r.import_source === "email" ? "status-pending" : "status-paid"}`}>
                                                    {r.import_source === "email" ? "Correo" : "Manual"}
                                                </span>
                                            </td>
                                            <td data-label="Acciones">
                                                <div className="action-buttons">
                                                    <button className="btn-icon" title={r.total_retenido ? `Retención: ${formatCOP(r.total_retenido)}` : "Aplicar retención"} onClick={() => setRetencionOf(r)} style={r.total_retenido ? { color: "var(--accent-teal)", borderColor: "var(--accent-teal)" } : undefined}>
                                                        <i className="ri-percent-line"></i>
                                                    </button>
                                                    <button className="btn-icon" title="Eliminar" onClick={() => setToDelete({ id: r._id, label: `${r.prefix ?? ""}${r.number ?? ""}` })}>
                                                        <i className="ri-delete-bin-line"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="pagination pagination--bottom">
                                <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}>Anterior</button>
                                <span className="pagination__info">Página {page} de {totalPages}</span>
                                <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>Siguiente</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <ImportModal
                isOpen={importOpen}
                kind={kind}
                onClose={() => setImportOpen(false)}
                onImported={() => setRefreshKey((k) => k + 1)}
            />
            <ConfirmModal
                isOpen={!!toDelete}
                title="Eliminar documento"
                message={`¿Eliminar el documento "${toDelete?.label}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                onClose={() => setToDelete(null)}
                onConfirm={handleDelete}
                loading={deleting}
            />
            <RetentionModal
                isOpen={!!retencionOf}
                purchase={retencionOf}
                onClose={() => setRetencionOf(null)}
                onApplied={() => { setRetencionOf(null); setRefreshKey((k) => k + 1); }}
            />
        </main>
    );
};

export default PurchasesPage;
