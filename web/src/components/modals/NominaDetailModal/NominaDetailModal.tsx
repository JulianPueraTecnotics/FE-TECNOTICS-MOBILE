import React, { useState } from "react";
import { type Nomina, resyncNominaStatus } from "../../../services/nomina.service";
import { AppDrawer } from "../../../components/design-system";
import {
    FORMA_PAGO_OPTIONS,
    PERIODO_NOMINA_OPTIONS,
    TIPO_CONTRATO_OPTIONS,
    TIPO_DOCUMENTO_OPTIONS,
    TIPO_TRABAJADOR_OPTIONS,
    labelFromCatalog,
} from "../../../features/nomina/nomina.constants";
import CopyButton from "../../shared/CopyButton/CopyButton";
import { errorToast, successToast } from "../../shared/toast/toasts";
import "../nomina-modals.css";

interface NominaDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    nomina: Nomina | null;
    /** Se llama con la nómina actualizada tras re-evaluar el estado DIAN. */
    onUpdated?: (nomina: Nomina) => void;
}

const statusLabel: Record<string, string> = {
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    PENDING: "Borrador",
    SENT: "Enviada",
};

const formatCOP = (value: number | string | undefined): string => {
    const n = typeof value === "string" ? Number(value) : value ?? 0;
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
};

/** Renderiza el valor de un concepto: si es objeto, lo aplana a "clave: valor · ...". */
const renderConceptoValue = (val: unknown): string => {
    if (val == null || val === "") return "—";
    if (typeof val === "object") {
        return Object.entries(val as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
            .join("  ·  ");
    }
    return String(val);
};

const NominaDetailModal: React.FC<NominaDetailModalProps> = ({ isOpen, onClose, nomina, onUpdated }) => {
    const [resyncing, setResyncing] = useState(false);

    if (!isOpen || !nomina) return null;

    const ne = nomina.NominaElectronica;
    const t = ne?.Trabajador;
    const emp = ne?.Empleador;
    const per = ne?.Periodo;
    const info = ne?.InformacionGeneral;
    const pago = ne?.Pago;
    const status = nomina.systemInfo?.nominaStatus ?? "PENDING";
    const fechasPago = Array.isArray(ne?.FechasPagos) ? ne.FechasPagos : [];

    const handleResync = async () => {
        setResyncing(true);
        try {
            const { nomina: updated } = await resyncNominaStatus(nomina._id);
            const newStatus = updated.systemInfo?.nominaStatus;
            if (newStatus === "APPROVED") successToast("La nómina está autorizada por la DIAN");
            else successToast("Estado actualizado");
            onUpdated?.(updated);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo re-evaluar el estado");
        } finally {
            setResyncing(false);
        }
    };

    const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
        <div className="detail-row">
            <span className="detail-label">{label}</span>
            <span className="detail-value">{children}</span>
        </div>
    );

    return (
        <AppDrawer
            title={`Nómina ${ne?.NumeroSecuenciaXML?.Numero ?? ""}`}
            titleIcon="ri-file-list-3-line"
            onClose={onClose}
            closeDisabled={resyncing}
            ariaLabelledBy="nomina-detail-title"
            footer={
                <button type="button" className="export-cancel" onClick={onClose}>
                    Cerrar
                </button>
            }
        >
                <div>
                    <span className={`status-badge status-${status.toLowerCase()}`} style={{ marginBottom: 12, display: "inline-block" }}>
                        {statusLabel[status] ?? status}
                    </span>
                    {/* Estado DIAN */}
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-shield-check-line"></i> Estado DIAN</h3>
                        <Row label="Estado">{statusLabel[status] ?? status}</Row>
                        <Row label="CUNE">
                            {nomina.systemInfo?.cune ? (
                                <span className="detail-mono">
                                    {nomina.systemInfo.cune}
                                    <CopyButton value={nomina.systemInfo.cune} label="CUNE" />
                                </span>
                            ) : "—"}
                        </Row>
                        {nomina.systemInfo?.dianDocKey && (
                            <Row label="Clave documento">
                                <span className="detail-mono">{nomina.systemInfo.dianDocKey}</span>
                            </Row>
                        )}
                        {nomina.systemInfo?.dianStatusDescr && (
                            <Row label="Respuesta DIAN">
                                <span className="detail-descr">{nomina.systemInfo.dianStatusDescr}</span>
                            </Row>
                        )}
                        {status === "REJECTED" && (
                            <button className="btn-secondary" type="button" onClick={handleResync} disabled={resyncing} style={{ marginTop: 8 }}>
                                {resyncing ? (<><i className="ri-loader-4-line rotating"></i> Re-evaluando...</>) : (<><i className="ri-refresh-line"></i> Re-evaluar estado DIAN</>)}
                            </button>
                        )}
                    </div>

                    {/* Empleador */}
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-building-line"></i> Empleador</h3>
                        <Row label="Razón social">{emp?.RazonSocial ?? "—"}</Row>
                        <Row label="NIT">{emp?.NIT ?? "—"}{emp?.DV ? `-${emp.DV}` : ""}</Row>
                        <Row label="Dirección">{emp?.Direccion ?? "—"}</Row>
                    </div>

                    {/* Trabajador */}
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-user-line"></i> Trabajador</h3>
                        <Row label="Nombre">{`${t?.PrimerNombre ?? ""} ${t?.OtrosNombres && t.OtrosNombres !== "." ? t.OtrosNombres : ""} ${t?.PrimerApellido ?? ""} ${t?.SegundoApellido && t.SegundoApellido !== "." ? t.SegundoApellido : ""}`.replace(/\s+/g, " ").trim() || "—"}</Row>
                        <Row label="Documento">{t?.TipoDocumento ? `${labelFromCatalog(TIPO_DOCUMENTO_OPTIONS, t.TipoDocumento)} ` : ""}{t?.NumeroDocumento ?? "—"}</Row>
                        <Row label="Tipo trabajador">{t?.TipoTrabajador ? labelFromCatalog(TIPO_TRABAJADOR_OPTIONS, t.TipoTrabajador) : "—"}</Row>
                        <Row label="Contrato">{t?.TipoContrato ? labelFromCatalog(TIPO_CONTRATO_OPTIONS, t.TipoContrato) : "—"}</Row>
                        <Row label="Sueldo base">{formatCOP(t?.Sueldo)}</Row>
                        <Row label="Lugar de trabajo">{t?.LugarTrabajoDireccion ?? "—"}</Row>
                    </div>

                    {/* Periodo y pago */}
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-calendar-line"></i> Periodo y pago</h3>
                        <Row label="Tipo de periodo">{info?.PeriodoNomina ? labelFromCatalog(PERIODO_NOMINA_OPTIONS, info.PeriodoNomina) : "—"}</Row>
                        <Row label="Liquidación">{per?.FechaLiquidacionInicio ?? "?"} → {per?.FechaLiquidacionFin ?? "?"}</Row>
                        <Row label="Fecha de ingreso">{per?.FechaIngreso ?? "—"}</Row>
                        <Row label="Tiempo laborado">{per?.TiempoLaborado ? `${per.TiempoLaborado} días` : "—"}</Row>
                        <Row label="Forma de pago">{pago?.Forma ? labelFromCatalog(FORMA_PAGO_OPTIONS, pago.Forma) : "—"}</Row>
                        <Row label="Fechas de pago">{fechasPago.length ? fechasPago.join(", ") : "—"}</Row>
                        <Row label="Fecha de generación">{info?.FechaGen ?? per?.FechaGen ?? "—"}</Row>
                    </div>

                    {/* Devengados */}
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-money-dollar-circle-line"></i> Devengados</h3>
                        {ne?.Devengados && Object.keys(ne.Devengados).length ? (
                            Object.entries(ne.Devengados).map(([key, val]) => (
                                <div key={key} className="detail-concepto">
                                    <span className="detail-concepto-name">{key}</span>
                                    <span className="detail-concepto-val">{renderConceptoValue(val)}</span>
                                </div>
                            ))
                        ) : (
                            <p className="field-hint">Sin devengados</p>
                        )}
                    </div>

                    {/* Deducciones */}
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-subtract-line"></i> Deducciones</h3>
                        {ne?.Deducciones && Object.keys(ne.Deducciones).length ? (
                            Object.entries(ne.Deducciones).map(([key, val]) => (
                                <div key={key} className="detail-concepto">
                                    <span className="detail-concepto-name">{key}</span>
                                    <span className="detail-concepto-val">{renderConceptoValue(val)}</span>
                                </div>
                            ))
                        ) : (
                            <p className="field-hint">Sin deducciones</p>
                        )}
                    </div>

                    {/* Totales */}
                    <div className="totales-card">
                        <div className="totales-row"><span>Total devengados</span><span>{formatCOP(ne?.DevengadosTotal)}</span></div>
                        <div className="totales-row"><span>Total deducciones</span><span className="deduccion">- {formatCOP(ne?.DeduccionesTotal)}</span></div>
                        <div className="totales-row total"><span>Comprobante total</span><span>{formatCOP(ne?.ComprobanteTotal)}</span></div>
                    </div>

                    {nomina.systemInfo?.send_by && (
                        <p className="field-hint">Emitida por {nomina.systemInfo.send_by}{nomina.createdAt ? ` · ${new Date(nomina.createdAt).toLocaleString("es-CO")}` : ""}</p>
                    )}
                </div>
        </AppDrawer>
    );
};

export default NominaDetailModal;
