import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../purchases/page/Purchases.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getPayable, getBanks, generateBatch } from "../treasury.service";
import type { PayableInvoice, Bank } from "../treasury.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import { PATHS } from "../../../router/paths.contants";

const formatCOP = (n: number, c = "COP") => (n || 0).toLocaleString("es-CO", { style: "currency", currency: c || "COP", minimumFractionDigits: 0 });

const TreasuryPaymentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState<PayableInvoice[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);

    // selección: id -> monto a pagar (default = saldo)
    const [selected, setSelected] = useState<Record<string, number>>({});
    const [bankId, setBankId] = useState("");
    const [generating, setGenerating] = useState(false);

    // Tiempo real: cualquier cambio de compras/lotes recarga la lista de pendientes.
    useRealtime(RealtimeEvents.PURCHASE_CHANGED, () => setRefreshKey((k) => k + 1));
    useRealtime(RealtimeEvents.BATCH_CHANGED, () => setRefreshKey((k) => k + 1));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [pay, bk] = await Promise.all([getPayable(debounced.trim()), getBanks()]);
            setRows(pay.purchases);
            setBanks(bk.banks.filter((b) => b.active));
            setBankId((prev) => prev || (bk.banks[0]?._id ?? ""));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar");
        } finally {
            setLoading(false);
        }
    }, [debounced, refreshKey]);

    useEffect(() => {
        load();
    }, [load]);

    const toggle = (inv: PayableInvoice) => {
        setSelected((prev) => {
            const next = { ...prev };
            if (next[inv._id] !== undefined) delete next[inv._id];
            else next[inv._id] = inv.balance;
            return next;
        });
    };

    const setMonto = (id: string, v: number) => setSelected((prev) => ({ ...prev, [id]: v }));

    const selectedRows = useMemo(() => rows.filter((r) => selected[r._id] !== undefined), [rows, selected]);
    const totalSelected = useMemo(() => selectedRows.reduce((acc, r) => acc + (selected[r._id] || 0), 0), [selectedRows, selected]);
    const anyMissingBank = selectedRows.some((r) => !r.supplier_bank.complete);

    const handleGenerate = async () => {
        if (!bankId) {
            errorToast("Selecciona el banco de origen");
            return;
        }
        if (!selectedRows.length) {
            errorToast("Selecciona al menos una factura");
            return;
        }
        if (anyMissingBank) {
            errorToast("Algunos proveedores seleccionados no tienen datos bancarios completos");
            return;
        }
        setGenerating(true);
        try {
            const items = selectedRows.map((r) => ({ purchase_id: r._id, monto: selected[r._id], referencia: `${r.prefix ?? ""}${r.number ?? ""}` }));
            const res = await generateBatch(bankId, items);
            successToast(res.message || "Lote generado");
            setSelected({});
            navigate(PATHS.TREASURY_LOTES);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo generar el lote");
        } finally {
            setGenerating(false);
        }
    };

    const totalPending = rows.reduce((acc, r) => acc + r.balance, 0);

    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>Pagos a proveedores</h1>
                        <p>Selecciona las facturas a pagar y genera un lote para el banco</p>
                    </div>
                    <div className="purchases-actions">
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input type="text" placeholder="Buscar proveedor, NIT, número..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>

                {!loading && rows.length > 0 && (
                    <div className="purchases-summary">
                        <span>Total por pagar:</span> <strong>{formatCOP(totalPending)}</strong>
                    </div>
                )}

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando facturas por pagar...</div>
                ) : rows.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-check-double-line"></i>
                        <p>No hay facturas pendientes de pago. ¡Todo al día!</p>
                    </div>
                ) : (
                    <>
                        {banks.length === 0 && (
                            <div className="purchases-summary" style={{ background: "rgba(255,159,67,.12)" }}>
                                <i className="ri-error-warning-line" style={{ color: "#e08a2b" }} />
                                <span>No tienes bancos configurados. Ve a <strong>Tesorería › Bancos</strong> para agregar la cuenta de pago.</span>
                            </div>
                        )}
                        <div className="purchases-table-container">
                            <table className="purchases-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40 }}></th>
                                        <th>Proveedor</th>
                                        <th>Factura</th>
                                        <th>Saldo</th>
                                        <th>A pagar</th>
                                        <th>Banco proveedor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const checked = selected[r._id] !== undefined;
                                        return (
                                            <tr key={r._id} style={checked ? { background: "rgba(90,159,180,.08)" } : undefined}>
                                                <td data-label="">
                                                    <input type="checkbox" checked={checked} onChange={() => toggle(r)} />
                                                </td>
                                                <td data-label="Proveedor">{r.supplier_name}<br /><span style={{ color: "var(--text-muted)", fontSize: ".8rem" }}>{r.supplier_doc}</span></td>
                                                <td data-label="Factura" className="document-number">{`${r.prefix ?? ""}${r.number ?? ""}` || "—"}</td>
                                                <td data-label="Saldo" className="document-total">{formatCOP(r.balance, r.currency)}</td>
                                                <td data-label="A pagar">
                                                    {checked ? (
                                                        <input
                                                            type="number"
                                                            value={selected[r._id]}
                                                            min={0}
                                                            max={r.balance}
                                                            onChange={(e) => setMonto(r._id, Math.min(Number(e.target.value) || 0, r.balance))}
                                                            style={{ width: 130, padding: "6px 8px", border: "1px solid var(--border-light)", borderRadius: 6 }}
                                                        />
                                                    ) : (
                                                        <span style={{ color: "var(--text-muted)" }}>—</span>
                                                    )}
                                                </td>
                                                <td data-label="Banco proveedor">
                                                    {r.supplier_bank.complete ? (
                                                        <span className="status-badge status-paid">{r.supplier_bank.banco || "OK"}</span>
                                                    ) : (
                                                        <span className="status-badge status-pending" title="Completa los datos bancarios en Proveedores">Sin datos bancarios</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Barra de acción de lote (cuando hay selección) */}
            {selectedRows.length > 0 && (
                <div className="treasury-actionbar">
                    <div className="treasury-actionbar__info">
                        <strong>{selectedRows.length}</strong> factura(s) · Total a pagar: <strong>{formatCOP(totalSelected)}</strong>
                        {anyMissingBank && <span className="treasury-actionbar__warn"><i className="ri-error-warning-line" /> Hay proveedores sin datos bancarios</span>}
                    </div>
                    <div className="treasury-actionbar__controls">
                        <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
                            <option value="">Banco de origen…</option>
                            {banks.map((b) => (
                                <option key={b._id} value={b._id}>{b.nombre_banco} · {b.numero_cuenta}</option>
                            ))}
                        </select>
                        <button className="btn-primary" onClick={handleGenerate} disabled={generating || anyMissingBank || !bankId}>
                            <i className="ri-bank-card-line" /> {generating ? "Generando..." : "Generar lote de pago"}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
};

export default TreasuryPaymentsPage;
