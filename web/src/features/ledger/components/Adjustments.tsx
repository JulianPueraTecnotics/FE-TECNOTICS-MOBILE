import { useEffect, useMemo, useState } from "react";
import { getCoa } from "../../accounting/accounting.service";
import type { CoaAccount } from "../../accounting/accounting.types";
import {
    amortizeDeferrals, provisionMonthly, exchangeRevaluation,
    type DeferralItem, type ProvisionItem, type ExchangeItem, type AdjustmentEntryResult,
} from "../ledger.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

type Tab = "diferidos" | "provisiones" | "cambio";
const money = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const now = new Date();
const defaultPeriodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

let _k = 0;
const newKey = () => `r${++_k}`;

// Filas locales con clave de render
type DeferralRow = DeferralItem & { _k: string };
type ProvisionRow = ProvisionItem & { _k: string };
type ExchangeRow = ExchangeItem & { _k: string };

const Adjustments: React.FC = () => {
    const [tab, setTab] = useState<Tab>("diferidos");
    const [accounts, setAccounts] = useState<CoaAccount[]>([]);
    const [periodo, setPeriodo] = useState(defaultPeriodo);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<AdjustmentEntryResult | null>(null);

    // Estado por cada tipo de ajuste
    const [deferrals, setDeferrals] = useState<DeferralRow[]>([{ _k: newKey(), cuenta_gasto: "", cuenta_diferido: "", valor: 0, meses: 12 }]);
    const [provisions, setProvisions] = useState<ProvisionRow[]>([{ _k: newKey(), cuenta_gasto: "", cuenta_pasivo: "", monto: 0 }]);
    const [exchanges, setExchanges] = useState<ExchangeRow[]>([{ _k: newKey(), cuenta: "", saldo_moneda: 0, trm_anterior: 0, trm_actual: 0, naturaleza: "activo" }]);
    const [cuentaIngresoDif, setCuentaIngresoDif] = useState("421505");
    const [cuentaGastoDif, setCuentaGastoDif] = useState("530520");

    useEffect(() => {
        getCoa(1, 300, "").then((r) => setAccounts(r.accounts)).catch(() => { /* el datalist queda vacío; igual se puede teclear el código */ });
    }, []);

    const accName = (codigo: string) => accounts.find((a) => a.codigo === codigo)?.nombre || "";

    // Resetea el resultado al cambiar de pestaña o período
    useEffect(() => { setResult(null); }, [tab, periodo]);

    // ── Totales por pestaña (para previsualizar el asiento antes de contabilizar) ──
    const totalDeferidos = useMemo(
        () => round2(deferrals.reduce((s, r) => s + (r.cuota ?? (r.meses && r.meses > 0 ? (r.valor || 0) / r.meses : 0)), 0)),
        [deferrals],
    );
    const totalProvisiones = useMemo(() => round2(provisions.reduce((s, r) => s + (r.monto || 0), 0)), [provisions]);
    const totalCambio = useMemo(
        () => round2(exchanges.reduce((s, r) => {
            let dif = (r.saldo_moneda || 0) * ((r.trm_actual || 0) - (r.trm_anterior || 0));
            if (r.naturaleza === "pasivo") dif = -dif;
            return s + dif;
        }, 0)),
        [exchanges],
    );

    const setDef = (k: string, patch: Partial<DeferralRow>) => setDeferrals((rows) => rows.map((r) => (r._k === k ? { ...r, ...patch } : r)));
    const setProv = (k: string, patch: Partial<ProvisionRow>) => setProvisions((rows) => rows.map((r) => (r._k === k ? { ...r, ...patch } : r)));
    const setExc = (k: string, patch: Partial<ExchangeRow>) => setExchanges((rows) => rows.map((r) => (r._k === k ? { ...r, ...patch } : r)));

    const strip = <T extends { _k: string }>(rows: T[]) => rows.map(({ _k, ...rest }) => rest);

    const submit = async () => {
        if (!/^\d{4}-\d{2}$/.test(periodo)) { errorToast("Período inválido (use AAAA-MM)"); return; }
        setSaving(true);
        setResult(null);
        try {
            let res: AdjustmentEntryResult;
            if (tab === "diferidos") {
                const items = strip(deferrals).filter((r) => r.cuenta_gasto && r.cuenta_diferido && (r.cuota || (r.meses && r.valor)));
                if (!items.length) { errorToast("Agrega al menos un diferido con cuentas y valor/cuota"); setSaving(false); return; }
                res = await amortizeDeferrals({ periodo, items });
            } else if (tab === "provisiones") {
                const items = strip(provisions).filter((r) => r.cuenta_gasto && r.cuenta_pasivo && r.monto > 0);
                if (!items.length) { errorToast("Agrega al menos una provisión con cuentas y monto"); setSaving(false); return; }
                res = await provisionMonthly({ periodo, items });
            } else {
                if (!cuentaIngresoDif || !cuentaGastoDif) { errorToast("Indica las cuentas de utilidad y pérdida en cambio"); setSaving(false); return; }
                const items = strip(exchanges).filter((r) => r.cuenta && r.saldo_moneda && (r.trm_actual !== r.trm_anterior));
                if (!items.length) { errorToast("Agrega al menos una cuenta con saldo y TRM distintas"); setSaving(false); return; }
                res = await exchangeRevaluation({ periodo, cuenta_ingreso_dif: cuentaIngresoDif, cuenta_gasto_dif: cuentaGastoDif, items });
            }
            setResult(res);
            // repostAuto devuelve entry=null si el período está cerrado (no contabiliza, silencioso).
            if (!res.entry) errorToast("El ajuste no se contabilizó: el período podría estar cerrado. Ábrelo en «Períodos» e intenta de nuevo.");
            else successToast(res.message);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo contabilizar el ajuste");
        } finally {
            setSaving(false);
        }
    };

    const coaList = <datalist id="adj-coa">{accounts.map((a) => <option key={a._id} value={a.codigo}>{a.codigo} — {a.nombre}</option>)}</datalist>;

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Ajustes contables del período</h2>
                    <p className="acc-sub">Amortización de diferidos, provisiones recurrentes y diferencia en cambio. Cada ajuste genera un comprobante de ajuste (NC) cuadrado y contabilizado. Es idempotente por período: re-ejecutar reemplaza el ajuste del mismo tipo y período.</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Período (AAAA-MM)</label><input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} /></div>
                </div>
            </div>

            <div className="led-tabs">
                <button className={tab === "diferidos" ? "active" : ""} onClick={() => setTab("diferidos")}>Amortización de diferidos</button>
                <button className={tab === "provisiones" ? "active" : ""} onClick={() => setTab("provisiones")}>Provisiones</button>
                <button className={tab === "cambio" ? "active" : ""} onClick={() => setTab("cambio")}>Diferencia en cambio</button>
            </div>

            {/* ── Diferidos ── */}
            {tab === "diferidos" && (
                <>
                    <p className="acc-sub" style={{ marginTop: 12 }}>Por cada diferido: <strong>D</strong> cuenta de gasto / <strong>C</strong> cuenta del diferido por la cuota del período. La cuota = valor ÷ meses (o indícala directamente).</p>
                    <table className="led-grid" style={{ marginTop: 8 }}>
                        <thead>
                            <tr>
                                <th>Descripción</th><th style={{ width: "14%" }}>Cuenta gasto</th><th style={{ width: "14%" }}>Cuenta diferido</th>
                                <th style={{ width: "13%" }}>Valor total</th><th style={{ width: "9%" }}>Meses</th><th style={{ width: "14%" }}>Cuota período</th><th style={{ width: 36 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {deferrals.map((r) => {
                                const cuota = round2(r.cuota ?? (r.meses && r.meses > 0 ? (r.valor || 0) / r.meses : 0));
                                return (
                                    <tr key={r._k}>
                                        <td><input value={r.descripcion ?? ""} onChange={(e) => setDef(r._k, { descripcion: e.target.value })} placeholder="Ej. Seguro anual" /></td>
                                        <td><input list="adj-coa" value={r.cuenta_gasto} onChange={(e) => setDef(r._k, { cuenta_gasto: e.target.value })} placeholder="51xx" title={accName(r.cuenta_gasto)} /></td>
                                        <td><input list="adj-coa" value={r.cuenta_diferido} onChange={(e) => setDef(r._k, { cuenta_diferido: e.target.value })} placeholder="1705/1710" title={accName(r.cuenta_diferido)} /></td>
                                        <td><input type="number" min={0} value={r.valor || ""} onChange={(e) => setDef(r._k, { valor: Number(e.target.value) || 0 })} /></td>
                                        <td><input type="number" min={1} value={r.meses ?? ""} onChange={(e) => setDef(r._k, { meses: Number(e.target.value) || 0 })} /></td>
                                        <td><input type="number" min={0} value={r.cuota ?? ""} placeholder={String(cuota || "")} onChange={(e) => setDef(r._k, { cuota: e.target.value === "" ? undefined : Number(e.target.value) })} /></td>
                                        <td><button className="btn-icon" onClick={() => setDeferrals((rs) => rs.filter((x) => x._k !== r._k))} disabled={deferrals.length <= 1}><i className="ri-close-line" /></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={5}><button className="btn-secondary" onClick={() => setDeferrals((rs) => [...rs, { _k: newKey(), cuenta_gasto: "", cuenta_diferido: "", valor: 0, meses: 12 }])}><i className="ri-add-line" /> Agregar diferido</button></td>
                                <td className="led-total">{money(totalDeferidos)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </>
            )}

            {/* ── Provisiones ── */}
            {tab === "provisiones" && (
                <>
                    <p className="acc-sub" style={{ marginTop: 12 }}>Por cada provisión: <strong>D</strong> cuenta de gasto / <strong>C</strong> cuenta de pasivo por el monto del período.</p>
                    <table className="led-grid" style={{ marginTop: 8 }}>
                        <thead>
                            <tr><th>Descripción</th><th style={{ width: "18%" }}>Cuenta gasto</th><th style={{ width: "18%" }}>Cuenta pasivo</th><th style={{ width: "16%" }}>Monto</th><th style={{ width: 36 }}></th></tr>
                        </thead>
                        <tbody>
                            {provisions.map((r) => (
                                <tr key={r._k}>
                                    <td><input value={r.descripcion ?? ""} onChange={(e) => setProv(r._k, { descripcion: e.target.value })} placeholder="Ej. Provisión prestaciones" /></td>
                                    <td><input list="adj-coa" value={r.cuenta_gasto} onChange={(e) => setProv(r._k, { cuenta_gasto: e.target.value })} placeholder="51xx/52xx" title={accName(r.cuenta_gasto)} /></td>
                                    <td><input list="adj-coa" value={r.cuenta_pasivo} onChange={(e) => setProv(r._k, { cuenta_pasivo: e.target.value })} placeholder="26xx" title={accName(r.cuenta_pasivo)} /></td>
                                    <td><input type="number" min={0} value={r.monto || ""} onChange={(e) => setProv(r._k, { monto: Number(e.target.value) || 0 })} /></td>
                                    <td><button className="btn-icon" onClick={() => setProvisions((rs) => rs.filter((x) => x._k !== r._k))} disabled={provisions.length <= 1}><i className="ri-close-line" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3}><button className="btn-secondary" onClick={() => setProvisions((rs) => [...rs, { _k: newKey(), cuenta_gasto: "", cuenta_pasivo: "", monto: 0 }])}><i className="ri-add-line" /> Agregar provisión</button></td>
                                <td className="led-total">{money(totalProvisiones)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </>
            )}

            {/* ── Diferencia en cambio ── */}
            {tab === "cambio" && (
                <>
                    <p className="acc-sub" style={{ marginTop: 12 }}>Revalúa saldos en moneda extranjera a la TRM de cierre. Diferencia = saldo × (TRM actual − TRM anterior). En pasivos el efecto se invierte.</p>
                    <div style={{ display: "flex", gap: 16, margin: "8px 0" }}>
                        <div className="acc-field" style={{ maxWidth: 220 }}><label>Cuenta utilidad en cambio</label><input list="adj-coa" value={cuentaIngresoDif} onChange={(e) => setCuentaIngresoDif(e.target.value)} placeholder="421505" title={accName(cuentaIngresoDif)} /></div>
                        <div className="acc-field" style={{ maxWidth: 220 }}><label>Cuenta pérdida en cambio</label><input list="adj-coa" value={cuentaGastoDif} onChange={(e) => setCuentaGastoDif(e.target.value)} placeholder="530520" title={accName(cuentaGastoDif)} /></div>
                    </div>
                    <table className="led-grid" style={{ marginTop: 4 }}>
                        <thead>
                            <tr>
                                <th>Descripción</th><th style={{ width: "12%" }}>Cuenta</th><th style={{ width: "10%" }}>Naturaleza</th>
                                <th style={{ width: "15%" }}>Saldo (moneda)</th><th style={{ width: "12%" }}>TRM anterior</th><th style={{ width: "12%" }}>TRM actual</th><th style={{ width: "13%" }}>Diferencia</th><th style={{ width: 36 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {exchanges.map((r) => {
                                let dif = (r.saldo_moneda || 0) * ((r.trm_actual || 0) - (r.trm_anterior || 0));
                                if (r.naturaleza === "pasivo") dif = -dif;
                                dif = round2(dif);
                                return (
                                    <tr key={r._k}>
                                        <td><input value={r.descripcion ?? ""} onChange={(e) => setExc(r._k, { descripcion: e.target.value })} placeholder="Ej. CxC USD cliente X" /></td>
                                        <td><input list="adj-coa" value={r.cuenta} onChange={(e) => setExc(r._k, { cuenta: e.target.value })} placeholder="1305/2205" title={accName(r.cuenta)} /></td>
                                        <td>
                                            <select value={r.naturaleza ?? "activo"} onChange={(e) => setExc(r._k, { naturaleza: e.target.value as "activo" | "pasivo" })}>
                                                <option value="activo">Activo</option>
                                                <option value="pasivo">Pasivo</option>
                                            </select>
                                        </td>
                                        <td><input type="number" value={r.saldo_moneda || ""} onChange={(e) => setExc(r._k, { saldo_moneda: Number(e.target.value) || 0 })} /></td>
                                        <td><input type="number" value={r.trm_anterior || ""} onChange={(e) => setExc(r._k, { trm_anterior: Number(e.target.value) || 0 })} /></td>
                                        <td><input type="number" value={r.trm_actual || ""} onChange={(e) => setExc(r._k, { trm_actual: Number(e.target.value) || 0 })} /></td>
                                        <td style={{ textAlign: "right", color: dif < 0 ? "var(--tertiary-color)" : "var(--secondary-color, inherit)", fontWeight: 600 }}>{money(dif)}</td>
                                        <td><button className="btn-icon" onClick={() => setExchanges((rs) => rs.filter((x) => x._k !== r._k))} disabled={exchanges.length <= 1}><i className="ri-close-line" /></button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6}><button className="btn-secondary" onClick={() => setExchanges((rs) => [...rs, { _k: newKey(), cuenta: "", saldo_moneda: 0, trm_anterior: 0, trm_actual: 0, naturaleza: "activo" }])}><i className="ri-add-line" /> Agregar cuenta</button></td>
                                <td className="led-total" style={{ color: totalCambio < 0 ? "var(--tertiary-color)" : undefined }}>{money(totalCambio)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </>
            )}

            {coaList}

            <div className="led-editor__foot" style={{ marginTop: 16 }}>
                <div className="acc-sub">El comprobante se fecha el día 28 del período (o ajústalo en el comprobante generado). Respeta los períodos contables cerrados.</div>
                <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? "Contabilizando..." : "Contabilizar ajuste"}</button>
            </div>

            {result?.entry && (
                <div className="acc-card" style={{ marginTop: 16, background: "var(--bg-subtle, rgba(0,0,0,.02))" }}>
                    <h3 style={{ margin: "0 0 8px" }}><i className="ri-checkbox-circle-line" style={{ color: "var(--secondary-color)" }} /> Comprobante generado</h3>
                    <p className="acc-sub" style={{ marginBottom: 8 }}>{result.entry.tipo} · {result.entry.descripcion} · {money(result.entry.total_debito)}</p>
                    <table className="acc-table">
                        <thead><tr><th>Cuenta</th><th>Descripción</th><th style={{ textAlign: "right" }}>Débito</th><th style={{ textAlign: "right" }}>Crédito</th></tr></thead>
                        <tbody>
                            {result.entry.lineas?.map((l, i) => (
                                <tr key={i}>
                                    <td><strong>{l.cuenta}</strong> {accName(l.cuenta) && <span className="acc-sub">— {accName(l.cuenta)}</span>}</td>
                                    <td className="acc-sub">{l.descripcion}</td>
                                    <td style={{ textAlign: "right" }}>{l.debito ? money(l.debito) : ""}</td>
                                    <td style={{ textAlign: "right" }}>{l.credito ? money(l.credito) : ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Adjustments;
