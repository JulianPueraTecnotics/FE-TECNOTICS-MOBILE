import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Admin.css";
import { PATHS } from "../../../router/paths.contants";
import { errorToast } from "../../../components/shared/toast/toasts";
import { adminListCompanies, type AdminCompanyListItem } from "../services/admin_companies.service";

const PAGE_SIZE = 20;

const AdminCompanies: React.FC = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [companies, setCompanies] = useState<AdminCompanyListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);

    // Debounce del buscador (vuelve a la página 1 al cambiar el término).
    useEffect(() => {
        const id = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(id);
    }, [search]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        adminListCompanies({ page, limit: PAGE_SIZE, search: debouncedSearch })
            .then((data) => {
                if (!active) return;
                setCompanies(data.companies ?? []);
                setTotal(data.total ?? 0);
                setPages(data.pages ?? 1);
            })
            .catch((error: unknown) => {
                if (!active) return;
                errorToast(error instanceof Error ? error.message : "Error al listar las empresas");
                setCompanies([]);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [page, debouncedSearch]);

    return (
        <main className="admin-page container-scroll">
            <div className="admin-page-header">
                <div>
                    <h1>Empresas</h1>
                    <p>{total} empresa(s) registradas</p>
                </div>
                <div className="admin-search">
                    <i className="ri-search-line" />
                    <input type="text" placeholder="Buscar por razón social, correo o NIT…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="admin-card">
                {loading ? (
                    <div className="admin-loading">Cargando empresas…</div>
                ) : companies.length === 0 ? (
                    <div className="admin-empty">No se encontraron empresas.</div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Empresa</th>
                                <th>Documento</th>
                                <th>Facturas</th>
                                <th>Items</th>
                                <th>Clientes</th>
                                <th>Prefijos</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map((c) => (
                                <tr key={c._id} className="admin-row-clickable" onClick={() => navigate(PATHS.ADMIN_COMPANY_DETAIL(c._id))}>
                                    <td>
                                        <div className="admin-company-cell">
                                            <div className="admin-logo">
                                                {c.logo?.url ? <img src={c.logo.url} alt={c.razon_social} /> : <i className="ri-building-line" />}
                                            </div>
                                            <div className="admin-company-cell-text">
                                                <span className="admin-company-name">{c.razon_social || "—"}</span>
                                                <span className="admin-company-email">{c.email || "—"}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {c.doc_number || "—"}
                                        {c.doc_number_dv ? `-${c.doc_number_dv}` : ""}
                                    </td>
                                    <td>{c.stats?.facturas ?? "—"}</td>
                                    <td>{c.stats?.items ?? "—"}</td>
                                    <td>{c.stats?.clientes ?? "—"}</td>
                                    <td>{c.stats?.prefijos ?? "—"}</td>
                                    <td>
                                        <span className={`admin-badge ${c.active ? "admin-badge-active" : "admin-badge-inactive"}`}>{c.active ? "Activa" : "Inactiva"}</span>
                                    </td>
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
                        Página {page} de {pages}
                    </span>
                    <button type="button" disabled={page >= pages || loading} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
                        Siguiente →
                    </button>
                </div>
            ) : null}
        </main>
    );
};

export default AdminCompanies;
