import { useCallback, useEffect, useState } from "react";
import { getEmpleadosConNomina, downloadForm220, type EmpleadoConNomina } from "../../../services/nomina.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

const thisYear = new Date().getFullYear();

/** Tab de certificados de nómina: Formulario 220 (ingresos y retenciones) por empleado/año. */
const NominaCertificados: React.FC = () => {
    const [anio, setAnio] = useState(thisYear);
    const [empleados, setEmpleados] = useState<EmpleadoConNomina[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getEmpleadosConNomina(anio);
            setEmpleados(res.empleados);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar empleados");
        } finally {
            setLoading(false);
        }
    }, [anio]);

    useEffect(() => {
        load();
    }, [load]);

    const onDownload = async (emp: EmpleadoConNomina) => {
        setBusy(emp._id);
        try {
            await downloadForm220(anio, emp._id, emp.nombre);
            successToast("Certificado generado");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al generar el certificado");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="nomina-cert">
            <div className="nomina-cert__head">
                <div>
                    <h3>Certificado de ingresos y retenciones — Formulario 220</h3>
                    <p className="nomina-cert__sub">Consolida los pagos laborales y la retención en la fuente del año por empleado (PDF). Documento informativo; no reemplaza el formato oficial DIAN.</p>
                </div>
                <div className="nomina-cert__year">
                    <label>Año gravable</label>
                    <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value) || thisYear)} />
                </div>
            </div>

            {loading ? (
                <div className="page-loading"><p>Cargando empleados...</p></div>
            ) : empleados.length === 0 ? (
                <div className="page-loading"><p>No hay empleados con nómina aprobada en {anio}.</p></div>
            ) : (
                <div className="nomina-table-container">
                    <table className="nomina-table">
                        <thead>
                            <tr>
                                <th>Empleado</th>
                                <th>Documento</th>
                                <th style={{ textAlign: "right" }}>Certificado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {empleados.map((e) => (
                                <tr key={e._id}>
                                    <td>{e.nombre}</td>
                                    <td>{e.tipo_documento} {e.numero_documento}</td>
                                    <td style={{ textAlign: "right" }}>
                                        <button className="btn-action" onClick={() => onDownload(e)} disabled={busy === e._id}>
                                            <i className="ri-file-pdf-line" /> {busy === e._id ? "Generando..." : "Formulario 220 PDF"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default NominaCertificados;
