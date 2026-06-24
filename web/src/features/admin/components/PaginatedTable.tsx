import { useEffect, useState } from "react";
import { errorToast } from "../../../components/shared/toast/toasts";

export interface Column<T> {
    header: string;
    render: (row: T) => React.ReactNode;
    align?: "left" | "right" | "center";
}

interface PaginatedTableProps<T> {
    /** Debe ser estable (useCallback) para no recargar en cada render. */
    fetchPage: (page: number) => Promise<{ items: T[]; total: number; pages: number }>;
    columns: Column<T>[];
    rowKey: (row: T) => string;
    emptyText: string;
    /** Cambiar este valor fuerza una recarga (p. ej. tras eliminar/crear). */
    reloadToken?: number;
}

export function PaginatedTable<T>({ fetchPage, columns, rowKey, emptyText, reloadToken = 0 }: PaginatedTableProps<T>) {
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<T[]>([]);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        fetchPage(page)
            .then((r) => {
                if (!active) return;
                setRows(r.items);
                setPages(r.pages);
                setTotal(r.total);
            })
            .catch((error: unknown) => {
                if (!active) return;
                errorToast(error instanceof Error ? error.message : "Error al cargar la información");
                setRows([]);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [page, fetchPage, reloadToken]);

    return (
        <>
            <div className="admin-card">
                {loading ? (
                    <div className="admin-loading">Cargando…</div>
                ) : rows.length === 0 ? (
                    <div className="admin-empty">{emptyText}</div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                {columns.map((c, i) => (
                                    <th key={i} style={{ textAlign: c.align ?? "left" }}>
                                        {c.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={rowKey(row)}>
                                    {columns.map((c, i) => (
                                        <td key={i} style={{ textAlign: c.align ?? "left" }}>
                                            {c.render(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {pages > 1 ? (
                <div className="admin-pagination">
                    <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        ← Anterior
                    </button>
                    <span>
                        Página {page} de {pages} · {total} registro(s)
                    </span>
                    <button type="button" disabled={page >= pages || loading} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                        Siguiente →
                    </button>
                </div>
            ) : null}
        </>
    );
}

export default PaginatedTable;
