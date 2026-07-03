import { useEffect, useMemo, useState } from "react";
import { getCoa } from "../../accounting/accounting.service";
import type { CoaAccount } from "../../accounting/accounting.types";
import {
    amortizeDeferrals,
    provisionMonthly,
    exchangeRevaluation,
    type DeferralItem,
    type ProvisionItem,
    type ExchangeItem,
    type AdjustmentEntryResult,
} from "../ledger.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl, FieldInput } from "../../../components/design-system";
import { formatMoney } from "../ledgerFormat";

const AdjInput: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
    <FieldInput icon={icon}>{children}</FieldInput>
);

type Tab = "diferidos" | "provisiones" | "cambio";
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const now = new Date();
const defaultPeriodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

let _k = 0;
const newKey = () => `r${++_k}`;

type DeferralRow = DeferralItem & { _k: string };
type ProvisionRow = ProvisionItem & { _k: string };
type ExchangeRow = ExchangeItem & { _k: string };

const Adjustments: React.FC = () => {
    const [tab, setTab] = useState<Tab>("diferidos");
    const [accounts, setAccounts] = useState<CoaAccount[]>([]);
    const [periodo, setPeriodo] = useState(defaultPeriodo);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<AdjustmentEntryResult | null>(null);

    const [deferrals, setDeferrals] = useState<DeferralRow[]>([
        { _k: newKey(), cuenta_gasto: "", cuenta_diferido: "", valor: 0, meses: 12 },
    ]);
    const [provisions, setProvisions] = useState<ProvisionRow[]>([
        { _k: newKey(), cuenta_gasto: "", cuenta_pasivo: "", monto: 0 },
    ]);
    const [exchanges, setExchanges] = useState<ExchangeRow[]>([
        { _k: newKey(), cuenta: "", saldo_moneda: 0, trm_anterior: 0, trm_actual: 0, naturaleza: "activo" },
    ]);
    const [cuentaIngresoDif, setCuentaIngresoDif] = useState("421505");
    const [cuentaGastoDif, setCuentaGastoDif] = useState("530520");

    useEffect(() => {
        getCoa(1, 300, "")
            .then((r) => setAccounts(r.accounts))
            .catch(() => {});
    }, []);

    const accName = (codigo: string) => accounts.find((a) => a.codigo === codigo)?.nombre || "";

    useEffect(() => {
        setResult(null);
    }, [tab, periodo]);

    const totalDeferidos = useMemo(
        () => round2(deferrals.reduce((s, r) => s + (r.cuota ?? (r.meses && r.meses > 0 ? (r.valor || 0) / r.meses : 0)), 0)),
        [deferrals],
    );
    const totalProvisiones = useMemo(() => round2(provisions.reduce((s, r) => s + (r.monto || 0), 0)), [provisions]);
    const totalCambio = useMemo(
        () =>
            round2(
                exchanges.reduce((s, r) => {
                    let dif = (r.saldo_moneda || 0) * ((r.trm_actual || 0) - (r.trm_anterior || 0));
                    if (r.naturaleza === "pasivo") dif = -dif;
                    return s + dif;
                }, 0),
            ),
        [exchanges],
    );

    const setDef = (k: string, patch: Partial<DeferralRow>) =>
        setDeferrals((rows) => rows.map((r) => (r._k === k ? { ...r, ...patch } : r)));
    const setProv = (k: string, patch: Partial<ProvisionRow>) =>
        setProvisions((rows) => rows.map((r) => (r._k === k ? { ...r, ...patch } : r)));
    const setExc = (k: string, patch: Partial<ExchangeRow>) =>
        setExchanges((rows) => rows.map((r) => (r._k === k ? { ...r, ...patch } : r)));

    const strip = <T extends { _k: string }>(rows: T[]) => rows.map(({ _k, ...rest }) => rest);

    const submit = async () => {
        if (!/^\d{4}-\d{2}$/.test(periodo)) {
            errorToast("Período inválido (use AAAA-MM)");
            return;
        }
        setSaving(true);
        setResult(null);
        try {
            let res: AdjustmentEntryResult;
            if (tab === "diferidos") {
                const items = strip(deferrals).filter((r) => r.cuenta_gasto && r.cuenta_diferido && (r.cuota || (r.meses && r.valor)));
                if (!items.length) {
                    errorToast("Agrega al menos un diferido con cuentas y valor/cuota");
                    setSaving(false);
                    return;
                }
                res = await amortizeDeferrals({ periodo, items });
            } else if (tab === "provisiones") {
                const items = strip(provisions).filter((r) => r.cuenta_gasto && r.cuenta_pasivo && r.monto > 0);
                if (!items.length) {
                    errorToast("Agrega al menos una provisión con cuentas y monto");
                    setSaving(false);
                    return;
                }
                res = await provisionMonthly({ periodo, items });
            } else {
                if (!cuentaIngresoDif || !cuentaGastoDif) {
                    errorToast("Indica las cuentas de utilidad y pérdida en cambio");
                    setSaving(false);
                    return;
                }
                const items = strip(exchanges).filter((r) => r.cuenta && r.saldo_moneda && r.trm_actual !== r.trm_anterior);
                if (!items.length) {
                    errorToast("Agrega al menos una cuenta con saldo y TRM distintas");
                    setSaving(false);
                    return;
                }
                res = await exchangeRevaluation({
                    periodo,
                    cuenta_ingreso_dif: cuentaIngresoDif,
                    cuenta_gasto_dif: cuentaGastoDif,
                    items,
                });
            }
            setResult(res);
            if (!res.entry)
                errorToast("El ajuste no se contabilizó: el período podría estar cerrado. Ábrelo en «Períodos» e intenta de nuevo.");
            else successToast(res.message);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo contabilizar el ajuste");
        } finally {
            setSaving(false);
        }
    };

    const coaList = (
        <datalist id="adj-coa">
            {accounts.map((a) => (
                <option key={a._id} value={a.codigo}>
                    {a.codigo} — {a.nombre}
                </option>
            ))}
        </datalist>
    );

    return (
        <div className="led-section">
            <p className="pm-hint">
                Amortización de diferidos, provisiones recurrentes y diferencia en cambio. Cada ajuste genera un comprobante de ajuste (NC) cuadrado y contabilizado.
            </p>

            <div className="led-section__toolbar">
                <FilterField label="Período (AAAA-MM)" htmlFor="adj-periodo" icon="ri-calendar-line">
                    <FieldControl id="adj-periodo" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
                </FilterField>
            </div>

            <div className="led-tabs led-tabs--adj">
                <button type="button" className={tab === "diferidos" ? "active" : ""} onClick={() => setTab("diferidos")}>
                    Amortización de diferidos
                </button>
                <button type="button" className={tab === "provisiones" ? "active" : ""} onClick={() => setTab("provisiones")}>
                    Provisiones
                </button>
                <button type="button" className={tab === "cambio" ? "active" : ""} onClick={() => setTab("cambio")}>
                    Diferencia en cambio
                </button>
            </div>

            {tab === "diferidos" && (
                <>
                    <p className="pm-hint">
                        Por cada diferido: <strong>D</strong> cuenta de gasto / <strong>C</strong> cuenta del diferido por la cuota del período.
                    </p>
                    <div className="purchases-table-container ds-table-container led-editable-table led-adj-table">
                        <table className="purchases-table ds-table">
                            <thead>
                                <tr>
                                    <th>Descripción</th>
                                    <th>Cuenta gasto</th>
                                    <th>Cuenta diferido</th>
                                    <th className="ds-num">Valor total</th>
                                    <th className="ds-num">Meses</th>
                                    <th className="ds-num">Cuota período</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {deferrals.map((r) => {
                                    const cuota = round2(r.cuota ?? (r.meses && r.meses > 0 ? (r.valor || 0) / r.meses : 0));
                                    return (
                                        <tr key={r._k}>
                                            <td data-label="Descripción">
                                                <AdjInput icon="ri-file-text-line">
                                                    <FieldControl value={r.descripcion ?? ""} onChange={(e) => setDef(r._k, { descripcion: e.target.value })} placeholder="Ej. Seguro anual" />
                                                </AdjInput>
                                            </td>
                                            <td data-label="Cuenta gasto">
                                                <AdjInput icon="ri-arrow-down-circle-line">
                                                    <FieldControl list="adj-coa" value={r.cuenta_gasto} onChange={(e) => setDef(r._k, { cuenta_gasto: e.target.value })} placeholder="51xx" title={accName(r.cuenta_gasto)} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="Cuenta diferido">
                                                <AdjInput icon="ri-time-line">
                                                    <FieldControl list="adj-coa" value={r.cuenta_diferido} onChange={(e) => setDef(r._k, { cuenta_diferido: e.target.value })} placeholder="1705/1710" title={accName(r.cuenta_diferido)} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="Valor total" className="ds-num">
                                                <AdjInput icon="ri-money-dollar-circle-line">
                                                    <FieldControl type="number" min={0} value={r.valor || ""} onChange={(e) => setDef(r._k, { valor: Number(e.target.value) || 0 })} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="Meses" className="ds-num">
                                                <AdjInput icon="ri-calendar-2-line">
                                                    <FieldControl type="number" min={1} value={r.meses ?? ""} onChange={(e) => setDef(r._k, { meses: Number(e.target.value) || 0 })} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="Cuota período" className="ds-num">
                                                <AdjInput icon="ri-coin-line">
                                                    <FieldControl type="number" min={0} value={r.cuota ?? ""} placeholder={String(cuota || "")} onChange={(e) => setDef(r._k, { cuota: e.target.value === "" ? undefined : Number(e.target.value) })} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="">
                                                <button type="button" className="btn-action" aria-label="Quitar diferido" onClick={() => setDeferrals((rs) => rs.filter((x) => x._k !== r._k))} disabled={deferrals.length <= 1}>
                                                    <i className="ri-close-line" aria-hidden />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5}>
                                        <button type="button" className="btn-secondary" onClick={() => setDeferrals((rs) => [...rs, { _k: newKey(), cuenta_gasto: "", cuenta_diferido: "", valor: 0, meses: 12 }])}>
                                            <i className="ri-add-line" aria-hidden /> Agregar diferido
                                        </button>
                                    </td>
                                    <td className="led-total ds-num" data-label="Total cuota período">{formatMoney(totalDeferidos)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}

            {tab === "provisiones" && (
                <>
                    <p className="pm-hint">
                        Por cada provisión: <strong>D</strong> cuenta de gasto / <strong>C</strong> cuenta de pasivo por el monto del período.
                    </p>
                    <div className="purchases-table-container ds-table-container led-editable-table led-adj-table">
                        <table className="purchases-table ds-table">
                            <thead>
                                <tr>
                                    <th>Descripción</th>
                                    <th>Cuenta gasto</th>
                                    <th>Cuenta pasivo</th>
                                    <th className="ds-num">Monto</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {provisions.map((r) => (
                                    <tr key={r._k}>
                                        <td data-label="Descripción">
                                            <AdjInput icon="ri-file-text-line">
                                                <FieldControl value={r.descripcion ?? ""} onChange={(e) => setProv(r._k, { descripcion: e.target.value })} placeholder="Ej. Provisión prestaciones" />
                                            </AdjInput>
                                        </td>
                                        <td data-label="Cuenta gasto">
                                            <AdjInput icon="ri-arrow-down-circle-line">
                                                <FieldControl list="adj-coa" value={r.cuenta_gasto} onChange={(e) => setProv(r._k, { cuenta_gasto: e.target.value })} placeholder="51xx/52xx" title={accName(r.cuenta_gasto)} />
                                            </AdjInput>
                                        </td>
                                        <td data-label="Cuenta pasivo">
                                            <AdjInput icon="ri-shield-line">
                                                <FieldControl list="adj-coa" value={r.cuenta_pasivo} onChange={(e) => setProv(r._k, { cuenta_pasivo: e.target.value })} placeholder="26xx" title={accName(r.cuenta_pasivo)} />
                                            </AdjInput>
                                        </td>
                                        <td data-label="Monto" className="ds-num">
                                            <AdjInput icon="ri-money-dollar-circle-line">
                                                <FieldControl type="number" min={0} value={r.monto || ""} onChange={(e) => setProv(r._k, { monto: Number(e.target.value) || 0 })} />
                                            </AdjInput>
                                        </td>
                                        <td data-label="">
                                            <button type="button" className="btn-action" aria-label="Quitar provisión" onClick={() => setProvisions((rs) => rs.filter((x) => x._k !== r._k))} disabled={provisions.length <= 1}>
                                                <i className="ri-close-line" aria-hidden />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3}>
                                        <button type="button" className="btn-secondary" onClick={() => setProvisions((rs) => [...rs, { _k: newKey(), cuenta_gasto: "", cuenta_pasivo: "", monto: 0 }])}>
                                            <i className="ri-add-line" aria-hidden /> Agregar provisión
                                        </button>
                                    </td>
                                    <td className="led-total ds-num" data-label="Total provisiones">{formatMoney(totalProvisiones)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}

            {tab === "cambio" && (
                <>
                    <p className="pm-hint">
                        Revalúa saldos en moneda extranjera a la TRM de cierre. Diferencia = saldo × (TRM actual − TRM anterior).
                    </p>
                    <div className="led-form-grid">
                        <FilterField label="Cuenta utilidad en cambio" htmlFor="adj-ing-dif" icon="ri-arrow-up-line">
                            <FieldControl id="adj-ing-dif" list="adj-coa" value={cuentaIngresoDif} onChange={(e) => setCuentaIngresoDif(e.target.value)} placeholder="421505" title={accName(cuentaIngresoDif)} />
                        </FilterField>
                        <FilterField label="Cuenta pérdida en cambio" htmlFor="adj-gas-dif" icon="ri-arrow-down-line">
                            <FieldControl id="adj-gas-dif" list="adj-coa" value={cuentaGastoDif} onChange={(e) => setCuentaGastoDif(e.target.value)} placeholder="530520" title={accName(cuentaGastoDif)} />
                        </FilterField>
                    </div>
                    <div className="purchases-table-container ds-table-container led-editable-table led-adj-table">
                        <table className="purchases-table ds-table">
                            <thead>
                                <tr>
                                    <th>Descripción</th>
                                    <th>Cuenta</th>
                                    <th>Naturaleza</th>
                                    <th className="ds-num">Saldo (moneda)</th>
                                    <th className="ds-num">TRM anterior</th>
                                    <th className="ds-num">TRM actual</th>
                                    <th className="ds-num">Diferencia</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {exchanges.map((r) => {
                                    let dif = (r.saldo_moneda || 0) * ((r.trm_actual || 0) - (r.trm_anterior || 0));
                                    if (r.naturaleza === "pasivo") dif = -dif;
                                    dif = round2(dif);
                                    return (
                                        <tr key={r._k}>
                                            <td data-label="Descripción">
                                                <AdjInput icon="ri-file-text-line">
                                                    <FieldControl value={r.descripcion ?? ""} onChange={(e) => setExc(r._k, { descripcion: e.target.value })} placeholder="Ej. CxC USD cliente X" />
                                                </AdjInput>
                                            </td>
                                            <td data-label="Cuenta">
                                                <AdjInput icon="ri-book-2-line">
                                                    <FieldControl list="adj-coa" value={r.cuenta} onChange={(e) => setExc(r._k, { cuenta: e.target.value })} placeholder="1305/2205" title={accName(r.cuenta)} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="Naturaleza">
                                                <AdjInput icon="ri-scales-3-line">
                                                    <FieldControl as="select" value={r.naturaleza ?? "activo"} onChange={(e) => setExc(r._k, { naturaleza: e.target.value as "activo" | "pasivo" })}>
                                                        <option value="activo">Activo</option>
                                                        <option value="pasivo">Pasivo</option>
                                                    </FieldControl>
                                                </AdjInput>
                                            </td>
                                            <td data-label="Saldo (moneda)" className="ds-num">
                                                <AdjInput icon="ri-exchange-dollar-line">
                                                    <FieldControl type="number" value={r.saldo_moneda || ""} onChange={(e) => setExc(r._k, { saldo_moneda: Number(e.target.value) || 0 })} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="TRM anterior" className="ds-num">
                                                <AdjInput icon="ri-exchange-line">
                                                    <FieldControl type="number" value={r.trm_anterior || ""} onChange={(e) => setExc(r._k, { trm_anterior: Number(e.target.value) || 0 })} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="TRM actual" className="ds-num">
                                                <AdjInput icon="ri-exchange-line">
                                                    <FieldControl type="number" value={r.trm_actual || ""} onChange={(e) => setExc(r._k, { trm_actual: Number(e.target.value) || 0 })} />
                                                </AdjInput>
                                            </td>
                                            <td data-label="Diferencia" className="ds-num led-adj-readonly" style={{ color: dif < 0 ? "var(--tertiary-color)" : "var(--secondary-color, inherit)", fontWeight: 600 }}>
                                                {formatMoney(dif)}
                                            </td>
                                            <td data-label="">
                                                <button type="button" className="btn-action" aria-label="Quitar cuenta" onClick={() => setExchanges((rs) => rs.filter((x) => x._k !== r._k))} disabled={exchanges.length <= 1}>
                                                    <i className="ri-close-line" aria-hidden />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={6}>
                                        <button type="button" className="btn-secondary" onClick={() => setExchanges((rs) => [...rs, { _k: newKey(), cuenta: "", saldo_moneda: 0, trm_anterior: 0, trm_actual: 0, naturaleza: "activo" }])}>
                                            <i className="ri-add-line" aria-hidden /> Agregar cuenta
                                        </button>
                                    </td>
                                    <td className="led-total ds-num" data-label="Total diferencia" style={{ color: totalCambio < 0 ? "var(--tertiary-color)" : undefined }}>
                                        {formatMoney(totalCambio)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </>
            )}

            {coaList}

            <div className="led-form-actions led-form-actions--end led-form-actions--adj">
                <p className="pm-hint" style={{ margin: 0, flex: "1 1 100%" }}>
                    El comprobante se fecha el día 28 del período. Respeta los períodos contables cerrados.
                </p>
                <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
                    {saving ? "Contabilizando..." : "Contabilizar ajuste"}
                </button>
            </div>

            {result?.entry && (
                <div className="led-note-card" style={{ marginTop: 16 }}>
                    <h3 style={{ margin: "0 0 8px" }}>
                        <i className="ri-checkbox-circle-line" style={{ color: "var(--secondary-color)" }} /> Comprobante generado
                    </h3>
                    <p className="pm-hint" style={{ marginBottom: 8 }}>
                        {result.entry.tipo} · {result.entry.descripcion} · {formatMoney(result.entry.total_debito)}
                    </p>
                    <div className="purchases-table-container ds-table-container led-adj-result">
                        <table className="purchases-table ds-table acc-table">
                            <thead>
                                <tr>
                                    <th>Cuenta</th>
                                    <th>Descripción</th>
                                    <th className="ds-num">Débito</th>
                                    <th className="ds-num">Crédito</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.entry.lineas?.map((l, i) => (
                                    <tr key={i}>
                                        <td>
                                            <strong>{l.cuenta}</strong>{" "}
                                            {accName(l.cuenta) && <span className="pm-hint">— {accName(l.cuenta)}</span>}
                                        </td>
                                        <td className="pm-hint">{l.descripcion}</td>
                                        <td className="ds-num">{l.debito ? formatMoney(l.debito) : ""}</td>
                                        <td className="ds-num">{l.credito ? formatMoney(l.credito) : ""}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Adjustments;
