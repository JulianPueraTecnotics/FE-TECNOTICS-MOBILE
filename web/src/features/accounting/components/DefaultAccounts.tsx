import { useEffect, useRef, useState } from "react";
import { getAccountingConfig, saveAccountingConfig, bootstrapAccounting, bootstrapTestData } from "../accounting.service";
import type { AccountingConfig, AccountPair } from "../accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useConfirm, FilterField, FieldControl } from "../../../components/design-system";
import { downloadRowsXlsx, downloadRowsCsv, readSpreadsheet, type ColumnDef } from "../import.utils";

const FIELDS: { key: keyof AccountingConfig; label: string }[] = [
    { key: "cuenta_por_pagar", label: "Cuenta por pagar" },
    { key: "cuenta_gasto_costo", label: "Cuenta de gasto / costo" },
    { key: "cuenta_iva", label: "Cuenta de IVA (descontable / compras)" },
    { key: "cuenta_ingreso", label: "Cuenta de ingreso (ventas)" },
    { key: "cuenta_iva_generado", label: "Cuenta de IVA generado (ventas)" },
    { key: "cuenta_cliente", label: "Cuenta de clientes (CxC)" },
    { key: "cuenta_inventario", label: "Cuenta de inventario (mercancías)" },
    { key: "cuenta_costo_ventas", label: "Cuenta de costo de ventas" },
    { key: "cuenta_retencion_sufrida", label: "Retención sufrida en recaudo (activo)" },
    { key: "cuenta_gasto_nomina", label: "Gasto de nómina (personal)" },
    { key: "cuenta_salarios_por_pagar", label: "Salarios por pagar (neto)" },
    { key: "cuenta_aportes_por_pagar", label: "Aportes salud/pensión por pagar" },
    { key: "cuenta_retencion_nomina_por_pagar", label: "Retención de nómina por pagar" },
    { key: "cuenta_retefuente", label: "Cuenta retefuente" },
    { key: "cuenta_reteiva", label: "Cuenta reteIVA" },
    { key: "cuenta_reteica", label: "Cuenta reteICA" },
    { key: "cuenta_anticipos", label: "Cuenta de anticipos" },
    { key: "cuenta_caja_menor", label: "Cuenta de caja menor" },
    { key: "cuenta_banco", label: "Cuenta de banco" },
    { key: "cuenta_resultado_ejercicio", label: "Resultado del ejercicio (cierre)" },
];

// Plantilla: una fila por cuenta (la clave interna en "cuenta", + niif y colgaap).
const DA_COLUMNS: ColumnDef[] = [
    { key: "cuenta", header: "cuenta", sample: "cuenta_por_pagar" },
    { key: "niif", header: "niif", sample: "22050501" },
    { key: "colgaap", header: "colgaap", sample: "22050501" },
];
const VALID_KEYS = new Set(FIELDS.map((f) => String(f.key)));

const DefaultAccounts: React.FC = () => {
    const { confirm } = useConfirm();
    const [config, setConfig] = useState<AccountingConfig>({ marco: "niif" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [bootstrapping, setBootstrapping] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    /** Siembra el PUC base + cuentas por defecto (no pisa lo ya configurado) y recarga. */
    const runBootstrap = async () => {
        if (!(await confirm("¿Inicializar la contabilidad con el PUC base colombiano y las cuentas por defecto? No reemplaza las cuentas que ya tengas configuradas."))) return;
        setBootstrapping(true);
        try {
            const res = await bootstrapAccounting();
            successToast(res.message);
            const fresh = await getAccountingConfig();
            setConfig(fresh.config);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo inicializar");
        } finally {
            setBootstrapping(false);
        }
    };

    /** Siembra datos mínimos de PRUEBA (UVT, retenciones, cliente/proveedor/ítem demo) para arrancar pruebas. */
    const runSeedTestData = async () => {
        if (!(await confirm("¿Sembrar datos de PRUEBA? Crea el PUC base, la UVT del año, conceptos de retención y un cliente/proveedor/ítem demo. Es idempotente: no duplica lo ya existente. Úsalo solo en empresas de prueba."))) return;
        setSeeding(true);
        try {
            const res = await bootstrapTestData();
            successToast(res.message);
            const fresh = await getAccountingConfig();
            setConfig(fresh.config);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudieron sembrar los datos de prueba");
        } finally {
            setSeeding(false);
        }
    };

    /** Plantilla con una fila por cada cuenta por defecto (clave + código actual si existe). */
    const downloadTemplate = (kind: "xlsx" | "csv") => {
        const headers = DA_COLUMNS.map((c) => c.header);
        const rows = FIELDS.map((f) => {
            const pair = (config[f.key] as AccountPair) || {};
            return [String(f.key), pair.niif ?? "", pair.colgaap ?? ""];
        });
        if (kind === "xlsx") downloadRowsXlsx("plantilla-cuentas-defecto.xlsx", headers, rows);
        else downloadRowsCsv("plantilla-cuentas-defecto.csv", headers, rows);
    };

    const onImport = async (file: File | null) => {
        if (!file) return;
        setImporting(true);
        try {
            const rows = await readSpreadsheet(file, DA_COLUMNS);
            const next: AccountingConfig = { ...config };
            let applied = 0;
            for (const r of rows) {
                const key = (r.cuenta || "").trim();
                if (!VALID_KEYS.has(key)) continue;
                (next as unknown as Record<string, unknown>)[key] = { niif: (r.niif || "").trim(), colgaap: (r.colgaap || "").trim() };
                applied++;
            }
            if (!applied) {
                errorToast("No se reconocieron cuentas. Usa la plantilla (columnas: cuenta, niif, colgaap).");
                return;
            }
            setConfig(next);
            await saveAccountingConfig(next);
            successToast(`${applied} cuenta(s) importada(s) y guardada(s)`);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al importar");
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await getAccountingConfig();
                setConfig(res.config);
            } catch (e) {
                errorToast(e instanceof Error ? e.message : "Error al cargar");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const setPair = (key: keyof AccountingConfig, marco: keyof AccountPair, value: string) => {
        setConfig((c) => ({ ...c, [key]: { ...(c[key] as AccountPair), [marco]: value } }));
    };

    const save = async () => {
        setSaving(true);
        try {
            await saveAccountingConfig(config);
            successToast("Configuración contable guardada");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>;

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Cuentas contables por defecto</h2>
                    <p className="acc-sub">Cuentas usadas por causación y tesorería. Puedes definir la cuenta NIIF y/o COLGAAP (PCGA), o importarlas desde Excel/CSV.</p>
                </div>
                <div className="acc-head-actions">
                    <button className="btn-primary" onClick={runBootstrap} disabled={bootstrapping} title="Crea el PUC base colombiano y asigna las cuentas por defecto (ventas, compras, recaudos, nómina). No reemplaza lo ya configurado.">
                        <i className="ri-magic-line" /> {bootstrapping ? "Inicializando..." : "Inicializar PUC + cuentas"}
                    </button>
                    <button className="btn-secondary" onClick={runSeedTestData} disabled={seeding} title="Siembra datos de PRUEBA: PUC, UVT del año, conceptos de retención y un cliente/proveedor/ítem demo. Idempotente. Úsalo solo en empresas de prueba para arrancar pruebas end-to-end.">
                        <i className="ri-flask-line" /> {seeding ? "Sembrando..." : "Datos de prueba"}
                    </button>
                    <button className="btn-secondary" onClick={() => downloadTemplate("xlsx")}><i className="ri-file-excel-2-line" /> Plantilla Excel</button>
                    <button className="btn-secondary" onClick={() => downloadTemplate("csv")}><i className="ri-file-text-line" /> Plantilla CSV</button>
                    <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
                        <i className="ri-upload-2-line" /> {importing ? "Importando..." : "Importar"}
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onImport(e.target.files?.[0] ?? null)} />
                </div>
            </div>

            <div className="led-form-grid" style={{ maxWidth: 320 }}>
                <FilterField label="Marco contable" htmlFor="da-marco" icon="ri-book-2-line">
                    <FieldControl id="da-marco" as="select" value={config.marco} onChange={(e) => setConfig((c) => ({ ...c, marco: e.target.value as AccountingConfig["marco"] }))}>
                        <option value="niif">NIIF</option>
                        <option value="colgaap">COLGAAP (PCGA)</option>
                        <option value="ambos">Ambos</option>
                    </FieldControl>
                </FilterField>
            </div>

            <div className="purchases-table-container ds-table-container led-editable-table" style={{ marginTop: 16 }}>
            <table className="purchases-table ds-table acc-table">
                <thead>
                    <tr><th>Cuenta</th><th>Código NIIF</th><th>Código COLGAAP</th></tr>
                </thead>
                <tbody>
                    {FIELDS.map((f) => {
                        const pair = (config[f.key] as AccountPair) || {};
                        return (
                            <tr key={String(f.key)}>
                                <td data-label="Cuenta">{f.label}</td>
                                <td data-label="Código NIIF">
                                    <FieldControl value={pair.niif ?? ""} onChange={(e) => setPair(f.key, "niif", e.target.value)} placeholder="Ej. 220505" />
                                </td>
                                <td data-label="Código COLGAAP">
                                    <FieldControl value={pair.colgaap ?? ""} onChange={(e) => setPair(f.key, "colgaap", e.target.value)} placeholder="Ej. 233505" />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>

            <div className="acc-actions">
                <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
            </div>
        </div>
    );
};

export default DefaultAccounts;
