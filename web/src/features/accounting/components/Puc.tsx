import { useCallback, useEffect, useRef, useState } from "react";
import { getCoa, importCoa } from "../accounting.service";
import type { CoaAccount } from "../accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { downloadRowsXlsx, downloadRowsCsv, readFirstColumn } from "../import.utils";

/**
 * Formato del PUC basado en el archivo de ejemplo "Cuentas contables.xlsx":
 * una sola columna con cabecera de metadatos y luego los códigos jerárquicos.
 *
 *   Cuentas contables        <- título
 *   EMPRESA EJEMPLO          <- razón social (solo de ejemplo)
 *   NIT EJEMPLO              <- NIT (solo de ejemplo)
 *   Código                   <- encabezado de la columna
 *   1, 11, 1105, 110505...   <- códigos (el nivel se deduce por la longitud)
 *
 * Al importar se ignoran las filas de metadatos y se toman solo los códigos numéricos.
 */
const PUC_TITLE = "Cuentas contables";
const PUC_HEADER_LABEL = "Código";
const PUC_SAMPLE_COMPANY = "EMPRESA EJEMPLO";
const PUC_SAMPLE_NIT = "NIT EJEMPLO";
const PUC_SAMPLE_CODES = ["1", "11", "1105", "110505", "11050501", "110510", "11051001"];

/** ¿La celda es un código de cuenta (solo dígitos)? */
const isCode = (v: string) => /^\d{1,}$/.test(v.replace(/\s/g, ""));

/** Deduce el nivel del PUC por la longitud del código (1,2,4,6,8 → 1..5). */
function levelFromCode(code: string): number {
    const len = code.length;
    if (len <= 1) return 1;
    if (len <= 2) return 2;
    if (len <= 4) return 3;
    if (len <= 6) return 4;
    return 5;
}

/** Código del padre por jerarquía PUC (longitudes 1,2,4,6,8). */
function parentCode(code: string): string | null {
    const len = code.length;
    if (len <= 1) return null;
    if (len <= 2) return code.slice(0, 1);
    if (len <= 4) return code.slice(0, 2);
    if (len <= 6) return code.slice(0, 4);
    if (len <= 8) return code.slice(0, 6);
    return code.slice(0, 8);
}

const Puc: React.FC = () => {
    const [accounts, setAccounts] = useState<CoaAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [importing, setImporting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getCoa(page, 50, search.trim());
            setAccounts(res.accounts);
            setTotalPages(res.pagination.totalPages);
            setTotal(res.pagination.total);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        load();
    }, [load]);

    /** Filas del archivo en el formato del ejemplo (cabecera + códigos). */
    const buildSheetRows = (codes: string[]): string[][] => [
        [PUC_TITLE],
        [PUC_SAMPLE_COMPANY],
        [PUC_SAMPLE_NIT],
        [PUC_HEADER_LABEL],
        ...codes.map((c) => [c]),
    ];

    /** Plantilla en blanco (con códigos de ejemplo) en el layout del archivo real. */
    const downloadTemplate = (kind: "xlsx" | "csv") => {
        const rows = buildSheetRows(PUC_SAMPLE_CODES);
        // No usamos encabezado tabular: todo va como filas de una sola columna.
        if (kind === "xlsx") downloadRowsXlsx("plantilla-cuentas-contables.xlsx", [PUC_TITLE], rows.slice(1), "Cuentas contables");
        else downloadRowsCsv("plantilla-cuentas-contables.csv", [PUC_TITLE], rows.slice(1));
    };

    /** Exporta TODO el PUC actual en el mismo formato del archivo de ejemplo. */
    const exportCoa = async (kind: "xlsx" | "csv") => {
        try {
            // Trae todas las cuentas (paginado grande).
            const all: string[] = [];
            let p = 1;
            for (;;) {
                const res = await getCoa(p, 200, "");
                all.push(...res.accounts.map((a) => a.codigo));
                if (p >= res.pagination.totalPages) break;
                p++;
            }
            if (!all.length) {
                errorToast("No hay cuentas para exportar");
                return;
            }
            const rows = buildSheetRows(all);
            if (kind === "xlsx") downloadRowsXlsx("cuentas-contables.xlsx", [PUC_TITLE], rows.slice(1), "Cuentas contables");
            else downloadRowsCsv("cuentas-contables.csv", [PUC_TITLE], rows.slice(1));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al exportar");
        }
    };

    const onFile = async (file: File | null) => {
        if (!file) return;
        setImporting(true);
        try {
            const cells = await readFirstColumn(file);
            // Toma solo las celdas que son códigos numéricos (ignora título, empresa, NIT, "Código").
            const codes = [...new Set(cells.filter(isCode))];
            if (!codes.length) {
                errorToast("No se encontraron códigos de cuenta en el archivo. Descarga la plantilla para ver el formato.");
                return;
            }
            // El modelo exige nombre: usamos el código como nombre por defecto (el ejemplo no trae nombres).
            const rows: Partial<CoaAccount>[] = codes.map((codigo) => ({
                codigo,
                nombre: codigo,
                nivel: levelFromCode(codigo),
                codigo_padre: parentCode(codigo),
            }));
            const res = await importCoa(rows);
            successToast(`${res.importadas} cuenta(s) importada(s)`);
            setPage(1);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al importar");
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Plan único de cuentas (PUC)</h2>
                    <p className="acc-sub">Importa tu catálogo de cuentas (Excel/CSV). Mismo formato que el archivo de ejemplo: una columna con los códigos (1, 11, 1105, 110505…).</p>
                </div>
                <div className="acc-head-actions">
                    <div className="search-box" style={{ border: "1px solid var(--border-light)", borderRadius: 8, padding: "6px 10px", display: "flex", gap: 6, alignItems: "center" }}>
                        <i className="ri-search-line" />
                        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar código" style={{ border: "none", outline: "none", background: "transparent" }} />
                    </div>
                    <button className="btn-secondary" onClick={() => downloadTemplate("xlsx")}><i className="ri-file-excel-2-line" /> Plantilla Excel</button>
                    <button className="btn-secondary" onClick={() => downloadTemplate("csv")}><i className="ri-file-text-line" /> Plantilla CSV</button>
                    {total > 0 && <button className="btn-secondary" onClick={() => exportCoa("xlsx")}><i className="ri-download-2-line" /> Exportar</button>}
                    <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={importing}>
                        <i className="ri-upload-2-line" /> {importing ? "Importando..." : "Importar"}
                    </button>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : accounts.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay cuentas en el PUC. Descarga la plantilla, llénala con tus códigos e impórtala.</p>
            ) : (
                <>
                    <p className="acc-sub" style={{ marginTop: 12 }}>{total} cuenta(s) en el plan.</p>
                    <table className="acc-table" style={{ marginTop: 4 }}>
                        <thead><tr><th>Código</th><th>Nivel</th><th>Cuenta padre</th></tr></thead>
                        <tbody>
                            {accounts.map((a) => (
                                <tr key={a._id}>
                                    <td>{a.codigo}</td>
                                    <td>{a.nivel ?? "—"}</td>
                                    <td>{a.codigo_padre ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {totalPages > 1 && (
                        <div className="pagination" style={{ marginTop: 12 }}>
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</button>
                            <span className="pagination__info">Página {page} de {totalPages}</span>
                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Siguiente</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Puc;
