import { useCallback, useEffect, useState } from "react";
import { getClosingStatus, closeYear, reopenYear } from "../ledger.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

const thisYear = new Date().getFullYear();

const YearClosing: React.FC = () => {
    const [anio, setAnio] = useState(thisYear - 1);
    const [status, setStatus] = useState<{ cerrado: boolean; borradores: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const s = await getClosingStatus(anio);
            setStatus({ cerrado: s.cerrado, borradores: s.borradores });
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [anio]);

    useEffect(() => { load(); }, [load]);

    const doClose = async () => {
        if (!confirm(`¿Cerrar el año ${anio}? Se cancelan las cuentas de resultado contra la utilidad/pérdida del ejercicio y se sellan los 12 meses.`)) return;
        setBusy(true);
        try {
            const res = await closeYear(anio);
            successToast(res.message);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cerrar");
        } finally {
            setBusy(false);
        }
    };

    const doReopen = async () => {
        if (!confirm(`¿Reabrir el año ${anio}? Se contabiliza el reverso del cierre y se reabren los 12 meses.`)) return;
        setBusy(true);
        try {
            const res = await reopenYear(anio);
            successToast(res.message);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al reabrir");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="acc-card">
            <h2>Cierre anual</h2>
            <p className="acc-sub">Cancela las cuentas de resultado (clases 4, 5, 6, 7) contra el resultado del ejercicio y sella el año. La reapertura revierte el cierre (nunca borra).</p>

            <div className="acc-grid acc-grid-3" style={{ alignItems: "end" }}>
                <div className="acc-field">
                    <label>Año a cerrar</label>
                    <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value) || thisYear - 1)} />
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 16 }}>Cargando...</div>
            ) : !status ? null : (
                <div style={{ marginTop: 16 }}>
                    {status.cerrado ? (
                        <>
                            <div className="led-balance ok"><i className="ri-lock-line" /> Año {anio} cerrado</div>
                            <p className="acc-sub" style={{ marginTop: 12 }}>Si necesitas corregir el ejercicio, reábrelo (se contabiliza el reverso del cierre y se reabren los períodos).</p>
                            <div className="acc-actions"><button className="btn-secondary" onClick={doReopen} disabled={busy}><i className="ri-lock-unlock-line" /> Reabrir año {anio}</button></div>
                        </>
                    ) : (
                        <>
                            {status.borradores > 0 ? (
                                <div className="led-balance bad"><i className="ri-error-warning-line" /> Hay {status.borradores} comprobante(s) en borrador en {anio}. Contabilízalos o anúlalos antes de cerrar.</div>
                            ) : (
                                <div className="led-balance ok"><i className="ri-checkbox-circle-line" /> Listo para cerrar — sin borradores pendientes</div>
                            )}
                            <p className="acc-sub" style={{ marginTop: 12 }}>Requiere la cuenta "Resultado del ejercicio" configurada en Configuración › Cuentas por defecto.</p>
                            <div className="acc-actions"><button className="btn-primary" onClick={doClose} disabled={busy || status.borradores > 0}><i className="ri-lock-line" /> Cerrar año {anio}</button></div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default YearClosing;
