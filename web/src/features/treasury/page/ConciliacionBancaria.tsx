import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import "../../purchases/page/Purchases.css";
import "../../recaudos/page/Recaudos.css";
import "../../ledger/page/Accounting.css";
import "../../purchases/components/PurchaseModals.css"; // pm-field, pm-grid, pm-hint…
import "./ConciliacionBancaria.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    generarSugerencias, listarMovimientos, documentosTercero, buscarTerceros,
    confirmarConciliacion, confirmarLote, rechazarConciliacion, crearConciliacionManual, enviarACuenta, registrarAnticipo,
    sugerirCuentaIA, crearCuentaPuc, pagosRecurrentes, type CuentaSugeridaIA, type GrupoRecurrente,
    type MovimientoConc, type DocPendiente,
} from "../conciliacion.service";
import { postStatements } from "../reconciliation.service";
import { getAchCatalog } from "../treasury.service";
import type { AchBank } from "../treasury.types";
import { getCoa } from "../../accounting/accounting.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    useConfirm,
    PaginationToolbar,
    paginationRange,
    FilterField,
    FieldControl,
    FiltersMobileDrawer,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";
import { AppModal } from "../../../components/design-system";
import { ConciliacionMovListViews } from "../components/ConciliacionMovListViews";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const fdate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "descripcion", label: "Descripción", type: "text", icon: "ri-file-text-line", serverSide: true },
    { id: "valor", label: "Valor", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "sugerencia", label: "¿Corresponde a?", type: "text", icon: "ri-links-line" },
];

/**
 * Extrae el NOMBRE del tercero de la descripción de un movimiento del extracto, quitando los
 * prefijos de ruido del banco (PAGO INTERBANC, PAGO DE PROV, TRANSFERENCIA, ABONO, etc.) y las
 * palabras de cola sin valor (DE, SAS…). Ej.: "Extracto banco · PAGO INTERBANC CONGREGACION DE"
 * → "CONGREGACION". Sirve para inferir el cliente/proveedor cuando no hay sugerencia por valor.
 */
const nombreDeMovimiento = (descripcion: string): string => {
    let s = String(descripcion || "")
        .replace(/^Extracto banco\s*[·\-:]\s*/i, "")
        .toUpperCase()
        // Prefijos de concepto típicos de extractos colombianos (Bancolombia, Davivienda, etc.).
        .replace(/\b(PAGO INTERBANC(ARIO)?|PAGO DE PROV(EEDOR)?(ES)?|PAGO A|PAGO|ABONO INTERESES|ABONO|TRANSFERENCIA|TRANSF|RECAUDO|CONSIGNACION|CONSIG|DEPOSITO|NOMINA|PSE|ACH|CR[ÉE]DITO|D[ÉE]BITO|REV|REVERSO|COMPRA|RETIRO|NEQUI|DAVIPLATA|MOVIMIENTO|INTERBANC)\b/gi, " ")
        .replace(/[0-9]+/g, " ")            // números (referencias, NITs sueltos)
        .replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, " ")  // signos
        .replace(/\s+/g, " ")
        .trim();
    // Quitar palabras de cola sin valor de búsqueda (preposiciones/sufijos societarios al final).
    s = s.replace(/\b(DE|DEL|LA|LAS|LOS|EL|Y|S\.?A\.?S?|LTDA|E\.?U|S\.?A\.?S\.?)\b\s*$/gi, "").trim();
    // Tomar las primeras 3 palabras significativas (el núcleo del nombre).
    return s.split(" ").filter((w) => w.length >= 3).slice(0, 3).join(" ").trim();
};

/**
 * Conciliación bancaria: muestra TODOS los movimientos del banco en dos vistas (Ingresos/Egresos).
 * Cada fila trae su sugerencia automática (confirmar 1 clic) o, si no la hay, se concilia manual
 * eligiendo la factura. También se pueden seleccionar varios movimientos de un tercero y agruparlos
 * contra varias facturas con validación de suma en vivo.
 */
const ConciliacionBancariaPage: React.FC = () => {
    const { confirm } = useConfirm();
    const [vista, setVista] = useState<"ingreso" | "egreso">("ingreso");
    const [movs, setMovs] = useState<MovimientoConc[]>([]);
    const [loading, setLoading] = useState(true);
    const [generando, setGenerando] = useState(false);
    const [importando, setImportando] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [filterSearch, setFilterSearch] = useState("");
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const [soloSugeridos, setSoloSugeridos] = useState(false);
    const [soloAlta, setSoloAlta] = useState(false);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});
    const getRowFilterValue = useCallback((row: MovimientoConc, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(row.fecha);
            case "descripcion": return row.descripcion ?? "";
            case "valor": return String(row.valor ?? 0);
            case "sugerencia": {
                const s = row.sugerencia;
                if (!s) return "";
                const parts = [...(s.numeros_factura ?? []), s.nombre_tercero ?? ""].filter(Boolean);
                return parts.join(" ");
            }
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || soloSugeridos || soloAlta || hasActiveClientFilters;
    const [busy, setBusy] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [conSug, setConSug] = useState(0);

    // Selección múltiple para agrupar.
    const [sel, setSel] = useState<Set<string>>(new Set());
    // "Ver iguales": concepto base por el que se filtra el servidor (persiste entre páginas).
    const [verIguales, setVerIguales] = useState<string | null>(null);

    // Modal de conciliación manual.
    const [modalMov, setModalMov] = useState<MovimientoConc | null>(null);
    const [modalGroup, setModalGroup] = useState(false); // modo agrupar varios
    const [docNit, setDocNit] = useState("");
    const [tercerosResult, setTercerosResult] = useState<{ doc: string; nombre: string }[]>([]);
    const [docs, setDocs] = useState<DocPendiente[]>([]);
    const [docSel, setDocSel] = useState<Set<string>>(new Set());
    const [applying, setApplying] = useState(false);
    // En la agrupación manual: llevar la diferencia (factura > pago) a retención en la fuente.
    const [aplicarRetencion, setAplicarRetencion] = useState(false);

    // Modal "enviar a cuenta contable".
    const [cuentaModal, setCuentaModal] = useState(false);
    const [cuentaSearch, setCuentaSearch] = useState("");
    const [cuentaResultados, setCuentaResultados] = useState<{ codigo: string; nombre: string; es_movimiento?: boolean }[]>([]);
    const [cuentaSel, setCuentaSel] = useState<{ codigo: string; nombre: string } | null>(null);
    // Detalle adicional: banco (autocompleta NIT desde el catálogo de bancos de Colombia).
    const [bancoTexto, setBancoTexto] = useState("");
    const [bancoNit, setBancoNit] = useState("");
    const [catalogoBancos, setCatalogoBancos] = useState<AchBank[]>([]);
    // Cuando hay filtro "ver iguales": enviar TODOS los del concepto (no solo los visibles).
    const [cuentaEnviarTodos, setCuentaEnviarTodos] = useState(true);
    // Sugerencia de IA (a qué cuenta del PUC va el movimiento).
    const [iaSugiriendo, setIaSugiriendo] = useState(false);
    const [iaSugerencia, setIaSugerencia] = useState<CuentaSugeridaIA | null>(null);
    // Crear cuenta del PUC desde el modal (cuando no existe la cuenta a reclasificar).
    const [crearForm, setCrearForm] = useState<{ codigo: string; nombre: string } | null>(null);
    const [creandoCuenta, setCreandoCuenta] = useState(false);
    // Pagos recurrentes (nómina, arriendos, pagos fijos).
    const [recurrentesModal, setRecurrentesModal] = useState(false);
    const [recurrentes, setRecurrentes] = useState<GrupoRecurrente[]>([]);
    const [cargandoRec, setCargandoRec] = useState(false);
    // Cuando "enviar a cuenta" viene de un grupo recurrente: ids exactos (aunque no estén en pantalla).
    const [grupoCuenta, setGrupoCuenta] = useState<{ ids: string[]; concepto: string; valor: number } | null>(null);

    const tipoFactura = vista === "ingreso" ? "venta" : "compra";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const busqueda = verIguales ?? debouncedSearch.trim();
            const r = await listarMovimientos({
                signo: vista, search: busqueda, soloSugeridos, soloAltaConfianza: soloAlta, page, pageSize,
            });
            setMovs(r.movimientos);
            setTotal(r.total);
            setConSug(r.con_sugerencia);
            setTotalPages(r.totalPages);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar los movimientos");
        } finally {
            setLoading(false);
        }
    }, [vista, debouncedSearch, soloSugeridos, soloAlta, page, pageSize, verIguales]);

    useEffect(() => { load(); }, [load]);
    // Cuando un job en background (confirmar lote / enviar a cuenta) TERMINA, recargar: así las
    // sugerencias que fallaron (quitadas optimistamente) vuelven a aparecer, y las exitosas se van.
    useRealtime(RealtimeEvents.BANK_JOB, (payload) => {
        const job = payload.item as { estado?: string } | undefined;
        if (job && (job.estado === "completado" || job.estado === "parcial" || job.estado === "error")) {
            void load();
        }
    });
    // Cambiar de vista/búsqueda/filtro vuelve a la página 1. (No limpiar sel aquí: ver iguales lo usa.)
    useEffect(() => { setPage(1); }, [vista, debouncedSearch, soloSugeridos, soloAlta, verIguales, pageSize]);
    useEffect(() => { setSel(new Set()); setVerIguales(null); }, [vista, debouncedSearch, soloSugeridos, soloAlta]);

    const generar = async () => {
        setGenerando(true);
        try {
            const r = await generarSugerencias({});
            successToast(`${r.ingresos} ingreso(s) y ${r.egresos} egreso(s) sugeridos (${r.con_retencion} con retención).`);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudieron generar las sugerencias");
        } finally {
            setGenerando(false);
        }
    };

    /** Importa uno o varios extractos (PDF / Excel / CSV) y los registra en el libro banco. */
    const importar = async (files: FileList | null) => {
        if (!files?.length) return;
        setImportando(true);
        try {
            const r = await postStatements(Array.from(files));
            successToast(r.message);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo importar el extracto");
        } finally {
            setImportando(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const confirmar = async (conciliacionId: string, asientoId: string) => {
        if (busy === asientoId) return; // evita doble confirmación por doble clic
        setBusy(asientoId);
        try {
            const r = await confirmarConciliacion(conciliacionId);
            successToast(r.message);
            setMovs((prev) => prev.filter((m) => m.asiento_id !== asientoId));
            setTotal((t) => Math.max(0, t - 1));
        } catch (e) {
            const msg = e instanceof Error ? e.message : "No se pudo confirmar";
            // Si ya estaba confirmada (doble clic / refresh), solo la quitamos de la lista sin error.
            if (/ya fue confirmada|ya tiene un pago/i.test(msg)) {
                setMovs((prev) => prev.filter((m) => m.asiento_id !== asientoId));
                setTotal((t) => Math.max(0, t - 1));
            } else {
                errorToast(msg);
            }
        } finally {
            setBusy(null);
        }
    };

    const [bulkBusy, setBulkBusy] = useState(false);

    /** Confirma en lote los movimientos SELECCIONADOS que tengan sugerencia (cada uno con su factura). */
    const confirmarSeleccionados = async () => {
        const conSugSel = seleccionados.filter((m) => m.sugerencia?.conciliacion_id);
        const ids = conSugSel.map((m) => m.sugerencia!.conciliacion_id);
        if (!ids.length) { errorToast("Ninguno de los seleccionados tiene sugerencia para confirmar"); return; }
        if (!(await confirm(`Se confirmarán ${ids.length} conciliación(es) sugerida(s), cada una con su factura. ¿Continuar?`))) return;
        setBulkBusy(true);
        try {
            const r = await confirmarLote({ ids });
            if (r.errores?.length) errorToast(r.message); else successToast(r.message);
            setSel(new Set()); setVerIguales(null);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudieron confirmar");
        } finally {
            setBulkBusy(false);
        }
    };

    /** Confirma TODAS las sugerencias de la vista actual (todas las páginas), opcionalmente del concepto filtrado. */
    const confirmarTodas = async () => {
        const ambito = verIguales ? `de “${verIguales.slice(0, 30)}”` : `de ${vista === "ingreso" ? "Ingresos" : "Egresos"}`;
        const prio = soloAlta ? " de prioridad ALTA" : "";
        // Muchas sugerencias → segundo plano (centro de actividades), sin bloquear la pantalla.
        const enAsync = conSug > 20;
        const conf = enAsync
            ? `Se confirmarán ${conSug} sugerencia(s)${prio} ${ambito} en segundo plano. Verás el avance junto al logo y las filas confirmadas desaparecerán. ¿Continuar?`
            : `Se confirmarán TODAS las sugerencias${prio} ${ambito} (todas las páginas), cada una con su factura. ¿Continuar?`;
        if (!(await confirm(conf))) return;
        setBulkBusy(true);
        try {
            const titulo = `Confirmar ${conSug} sugerencia(s) ${vista === "ingreso" ? "de ingresos" : "de egresos"}`;
            const r = await confirmarLote({ signo: vista, concepto: verIguales ?? undefined, soloAlta, async: enAsync, titulo });
            if (enAsync) {
                // Optimista: las sugerencias salen de la vista de inmediato. El job corre en segundo plano;
                // si alguna falla, al recargar (cuando termine) vuelve a aparecer.
                successToast(`${r.message} Verás el avance junto al logo.`);
                setMovs((prev) => prev.filter((m) => !m.sugerencia)); // quita las que tienen sugerencia
            } else {
                if (r.errores?.length) errorToast(r.message); else successToast(r.message);
                await load();
            }
            setSel(new Set()); setVerIguales(null);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudieron confirmar");
        } finally {
            setBulkBusy(false);
        }
    };

    const rechazar = async (conciliacionId: string, asientoId: string) => {
        if (busy === asientoId) return; // evita doble acción
        // Tras rechazar, ofrece buscar la siguiente mejor factura para ese movimiento.
        const buscarNueva = await confirm({
            title: "Rechazar sugerencia",
            message: "¿Quieres que busque otra factura que coincida con este movimiento?\n\nBuscar otra = nueva sugerencia · Cancelar = solo rechazar.",
            confirmText: "Buscar otra",
            cancelText: "Solo rechazar",
        });
        setBusy(asientoId);
        try {
            const r = await rechazarConciliacion(conciliacionId, buscarNueva);
            successToast(r.message);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo rechazar");
        } finally {
            setBusy(null);
        }
    };

    const toggle = (id: string) => {
        const mov = movs.find((m) => m.asiento_id === id);
        setSel((prev) => {
            const n = new Set(prev);
            if (n.has(id)) {
                n.delete(id);
                // Si ya no queda ninguno seleccionado, se quita el filtro "ver iguales".
                if (n.size === 0) setVerIguales(null);
            } else {
                n.add(id);
                // Al seleccionar el PRIMER movimiento, filtra automáticamente por su descripción EXACTA
                // (todos los iguales, en todas las páginas). El propio movimiento siempre queda visible.
                if (!verIguales && mov) setVerIguales(mov.descripcion);
            }
            return n;
        });
    };

    /** Selecciona/deselecciona TODOS los movimientos visibles (respeta el filtro "ver iguales"). */
    const toggleAll = () => setSel((prev) => {
        const visibles = movsVisibles.map((m) => m.asiento_id);
        const todos = visibles.length > 0 && visibles.every((id) => prev.has(id));
        const n = new Set(prev);
        if (todos) visibles.forEach((id) => n.delete(id));
        else visibles.forEach((id) => n.add(id));
        return n;
    });

    // ── Enviar a cuenta contable ──
    const abrirCuenta = async () => {
        if (!seleccionados.length) { errorToast("Selecciona al menos un movimiento"); return; }
        setGrupoCuenta(null); // este flujo usa la selección normal, no un grupo recurrente
        setCuentaSel(null); setCuentaSearch(""); setCuentaResultados([]);
        setBancoTexto(""); setBancoNit(""); setIaSugerencia(null); setCrearForm(null);
        setCuentaModal(true);
        if (!catalogoBancos.length) {
            try { const r = await getAchCatalog(); setCatalogoBancos(r.banks); } catch { /* opcional */ }
        }
    };

    // ── Sugerencia de IA: a qué cuenta del PUC va este movimiento ──
    const sugerirCuenta = async () => {
        if (!seleccionados.length) { errorToast("Selecciona al menos un movimiento"); return; }
        const mov = seleccionados[0];
        setIaSugiriendo(true);
        setIaSugerencia(null);
        // Abre el modal para mostrar el resultado dentro del flujo de "enviar a cuenta".
        setCuentaSel(null); setCuentaSearch(""); setCuentaResultados([]);
        setBancoTexto(""); setBancoNit("");
        setCuentaModal(true);
        if (!catalogoBancos.length) { try { const r = await getAchCatalog(); setCatalogoBancos(r.banks); } catch { /* opcional */ } }
        try {
            const r = await sugerirCuentaIA(mov.descripcion, { signo: vista, valor: mov.valor });
            setIaSugerencia(r);
            if (r.cuenta) {
                // Precarga la cuenta sugerida: la busca en el PUC (llena la tabla) y la deja seleccionada.
                setCuentaSearch(r.cuenta.codigo);
                await buscarCuentas(r.cuenta.codigo);
                setCuentaSel({ codigo: r.cuenta.codigo, nombre: r.cuenta.nombre });
            }
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo obtener la sugerencia de IA");
        } finally {
            setIaSugiriendo(false);
        }
    };
    // ── Pagos recurrentes (nómina, arriendos, pagos fijos) ──
    const abrirRecurrentes = async () => {
        setRecurrentesModal(true);
        setCargandoRec(true);
        try {
            const r = await pagosRecurrentes(vista, 3);
            setRecurrentes(r.grupos);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudieron detectar los pagos recurrentes");
        } finally {
            setCargandoRec(false);
        }
    };
    /** Abre el modal de "enviar a cuenta" para TODOS los movimientos de un grupo recurrente. */
    const enviarGrupoACuenta = async (g: GrupoRecurrente) => {
        // Guardamos los ids exactos del grupo (pueden estar en otras páginas, no solo los visibles).
        setGrupoCuenta({ ids: g.ids, concepto: g.concepto, valor: g.valor });
        setSel(new Set()); // la selección normal no aplica aquí
        setRecurrentesModal(false);
        setCuentaSel(null); setCuentaSearch(""); setCuentaResultados([]);
        setBancoTexto(""); setBancoNit(""); setIaSugerencia(null); setCrearForm(null);
        setCuentaModal(true);
        if (!catalogoBancos.length) { try { const r = await getAchCatalog(); setCatalogoBancos(r.banks); } catch { /* opcional */ } }
        // Sugerencia IA de la cuenta usando el concepto del grupo.
        setIaSugiriendo(true);
        try {
            const r = await sugerirCuentaIA(g.concepto, { signo: vista, valor: g.valor });
            setIaSugerencia(r);
            if (r.cuenta) { setCuentaSearch(r.cuenta.codigo); await buscarCuentas(r.cuenta.codigo); setCuentaSel({ codigo: r.cuenta.codigo, nombre: r.cuenta.nombre }); }
        } catch { /* opcional */ } finally { setIaSugiriendo(false); }
    };

    /** Al escribir el banco, autocompleta el NIT desde el catálogo de bancos de Colombia. */
    const onBancoChange = (texto: string) => {
        setBancoTexto(texto);
        const t = texto.trim().toUpperCase();
        const match = catalogoBancos.find((b) => b.nombre === t) || catalogoBancos.find((b) => t.length >= 3 && b.nombre.includes(t));
        setBancoNit(match?.nit ?? "");
    };
    const buscarCuentas = async (q: string) => {
        setCuentaSel(null); // al cambiar el texto, se anula la selección previa
        setCrearForm(null); // y se cierra el formulario de crear cuenta
        if (q.trim().length < 2) { setCuentaResultados([]); return; }
        try {
            const r = await getCoa(1, 30, q.trim());
            // Solo cuentas de movimiento (auxiliares de 8 dígitos), que son las contabilizables.
            const cuentas = r.accounts.filter((a) => a.es_movimiento !== false).map((a) => ({ codigo: a.codigo, nombre: a.nombre, es_movimiento: a.es_movimiento }));
            setCuentaResultados(cuentas);
            // Si escribiste un código EXACTO que existe, lo seleccionamos automáticamente.
            const exacta = cuentas.find((c) => c.codigo === q.trim());
            if (exacta) setCuentaSel({ codigo: exacta.codigo, nombre: exacta.nombre });
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al buscar cuentas");
        }
    };
    /** Abre el formulario para crear la cuenta que el usuario buscó (precarga código si parece válido). */
    const abrirCrearCuenta = () => {
        const codigo = cuentaSearch.trim().replace(/\D/g, "");
        // Si la IA propuso una cuenta (aunque no exista en el PUC), precarga su nombre.
        const nombre = iaSugerencia?.cuenta?.nombre ?? "";
        setCrearForm({ codigo, nombre });
    };
    /** Crea la cuenta en el PUC y la deja seleccionada para contabilizar. */
    const crearCuenta = async () => {
        if (!crearForm) return;
        if (!/^\d{4,12}$/.test(crearForm.codigo)) { errorToast("El código debe tener solo dígitos (4 a 12)."); return; }
        if (!crearForm.nombre.trim()) { errorToast("Indica el nombre de la cuenta."); return; }
        setCreandoCuenta(true);
        try {
            const r = await crearCuentaPuc(crearForm.codigo, crearForm.nombre.trim());
            successToast(r.message);
            setCuentaSel({ codigo: r.cuenta.codigo, nombre: r.cuenta.nombre });
            setCuentaSearch(r.cuenta.codigo);
            setCuentaResultados([{ codigo: r.cuenta.codigo, nombre: r.cuenta.nombre, es_movimiento: true }]);
            setCrearForm(null);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo crear la cuenta");
        } finally {
            setCreandoCuenta(false);
        }
    };
    /** Cierra el modal de "enviar a cuenta" limpiando también el grupo recurrente. */
    const cerrarCuentaModal = () => { setCuentaModal(false); setGrupoCuenta(null); };
    const aplicarACuenta = async () => {
        if (!cuentaSel) { errorToast("Elige la cuenta contable destino"); return; }
        setApplying(true);
        try {
            const detalle = { bancoNombre: bancoTexto.trim() || undefined, bancoNit: bancoNit.trim() || undefined };
            let r;
            let enAsync: boolean;
            if (grupoCuenta) {
                // Viene de un grupo de PAGOS RECURRENTES: usa sus ids exactos (aunque no estén en pantalla).
                enAsync = grupoCuenta.ids.length > 20;
                const titulo = `Llevar ${grupoCuenta.ids.length} pago(s) recurrentes a ${cuentaSel.codigo} — ${cuentaSel.nombre}`;
                r = await enviarACuenta(cuentaSel.codigo, { ...detalle, asientoIds: grupoCuenta.ids, async: enAsync, titulo });
            } else {
                // "Enviar TODOS" aplica cuando hay un concepto activo (filtro "ver iguales" O búsqueda) y
                // hay más resultados (total) que los visibles seleccionados. Procesa TODO el concepto.
                const enviarTodos = cuentaEnviarTodos && !!conceptoActivo && total > seleccionados.length;
                const cuantos = enviarTodos ? total : seleccionados.length;
                if (!enviarTodos && !seleccionados.length) { errorToast("Selecciona al menos un movimiento."); setApplying(false); return; }
                enAsync = cuantos > 20;
                const titulo = `Llevar ${cuantos} mov. a ${cuentaSel.codigo} — ${cuentaSel.nombre}`;
                r = enviarTodos
                    ? await enviarACuenta(cuentaSel.codigo, { ...detalle, signo: vista, concepto: conceptoActivo!, async: enAsync, titulo })
                    : await enviarACuenta(cuentaSel.codigo, { ...detalle, asientoIds: seleccionados.map((m) => m.asiento_id), async: enAsync, titulo });
            }
            successToast(enAsync ? `${r.message} Verás el avance junto al logo.` : r.message);
            setCuentaModal(false);
            // Limpia TODOS los filtros (selección, "ver iguales", grupo y el buscador) para volver a la
            // vista completa — antes el `search` quedaba pegado y la lista parecía vacía tras la acción.
            setSel(new Set()); setVerIguales(null); setGrupoCuenta(null); setFilterSearch("");
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo llevar a la cuenta");
        } finally {
            setApplying(false);
        }
    };

    const seleccionados = useMemo(() => movs.filter((m) => sel.has(m.asiento_id)), [movs, sel]);
    const sumaSel = useMemo(() => seleccionados.reduce((s, m) => s + Math.abs(m.valor), 0), [seleccionados]);
    const filtroIguales = verIguales; // concepto activo del filtro "ver iguales" (texto base)
    const movsVisibles = filterRows(movs);
    // Concepto activo para operar sobre TODO el conjunto filtrado (no solo la página visible):
    // el filtro "ver iguales" o, en su defecto, lo que esté escrito en el buscador.
    const conceptoActivo = verIguales ?? (debouncedSearch.trim() || null);

    const safePage = Math.min(page, totalPages);
    const { start, end } = paginationRange(safePage, pageSize, total);

    const handlePageChange = (nextPage: number) => setPage(Math.max(1, Math.min(totalPages, nextPage)));
    const handlePageSizeChange = (nextSize: number) => { setPageSize(normalizePageSize(nextSize)); setPage(1); };
    const clearFilters = () => { setFilterSearch(""); setSoloSugeridos(false); setSoloAlta(false); clearColFilters(); };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;
        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(480, window.innerWidth - 32);
        const left = Math.max(16, rect.right - width);
        const panelHeight = panel?.offsetHeight ?? 0;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const openUp = panelHeight > 0 && spaceBelow < panelHeight && rect.top > panelHeight + gap;
        const top = openUp ? rect.top - gap - panelHeight : rect.bottom + gap;
        setFiltersPanelStyle({ position: "fixed", top: Math.max(8, top), left, width });
    }, []);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const sync = () => setIsMobile(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    useLayoutEffect(() => {
        if (!filtersOpen || isMobile) return;
        updateFiltersPanelPosition();
        const frame = requestAnimationFrame(updateFiltersPanelPosition);
        return () => cancelAnimationFrame(frame);
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, soloSugeridos, soloAlta, colFilterValues]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onReflow = () => updateFiltersPanelPosition();
        window.addEventListener("resize", onReflow);
        window.addEventListener("scroll", onReflow, true);
        return () => { window.removeEventListener("resize", onReflow); window.removeEventListener("scroll", onReflow, true); };
    }, [filtersOpen, isMobile, updateFiltersPanelPosition]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onPointer = (e: MouseEvent) => {
            const target = e.target as Node;
            if (filtersDropdownRef.current?.contains(target) || filtersPanelRef.current?.contains(target)) return;
            setFiltersOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFiltersOpen(false); };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
    }, [filtersOpen, isMobile]);

    useEffect(() => {
        if (!filtersOpen || !isMobile) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [filtersOpen, isMobile]);

    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    // ── Modal manual ──
    const abrirManual = (m: MovimientoConc) => {
        setModalMov(m);
        setModalGroup(false);
        setDocs([]);
        setDocSel(new Set());
        setTercerosResult([]);
        if (m.sugerencia?.nit_tercero) {
            // Hay sugerencia por valor: precarga su tercero y sus documentos.
            setDocNit(m.sugerencia.nit_tercero);
            setTerceroNombre(m.sugerencia.nombre_tercero ?? "");
            void buscarDocs(m.sugerencia.nit_tercero);
        } else {
            // Sin sugerencia: infiere el tercero por el NOMBRE de la descripción del banco
            // (ej. "PAGO INTERBANC CONGREGACION DE…" → cliente CONGREGACION). Así el modal no abre vacío.
            setDocNit("");
            setTerceroNombre("");
            void inferirTerceroPorNombre(m);
        }
    };

    /** Extrae el nombre del tercero de la descripción del banco y, si hay un único match, lo precarga. */
    const inferirTerceroPorNombre = async (m: MovimientoConc) => {
        const nombre = nombreDeMovimiento(m.descripcion);
        if (nombre.length < 3) return;
        try {
            const r = await buscarTerceros(nombre, tipoFactura);
            if (r.terceros.length === 1) {
                // Un único candidato: lo elegimos y traemos sus documentos pendientes.
                elegirTercero(r.terceros[0]);
            } else if (r.terceros.length > 1) {
                // Varios: mostramos la lista para que el usuario elija (precargada en el modal).
                setDocNit(nombre);
                setTercerosResult(r.terceros);
            }
        } catch { /* opcional: el usuario puede escribir el cliente manualmente */ }
    };
    const abrirGrupo = () => {
        if (!seleccionados.length) { errorToast("Selecciona al menos un movimiento"); return; }
        setModalMov(null);
        setModalGroup(true);
        setDocNit("");
        setDocs([]);
        setDocSel(new Set());
    };
    const buscarDocs = async (nit: string) => {
        if (!nit.trim()) { setDocs([]); return; }
        try {
            const r = await documentosTercero(nit.trim(), tipoFactura);
            setDocs(r.documentos);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al buscar documentos");
        }
    };
    // Nombre del cliente elegido (para el anticipo). Se fija al elegir un tercero.
    const [terceroNombre, setTerceroNombre] = useState("");

    /** Registra los movimientos seleccionados como ANTICIPO del cliente (sin aplicar a factura). */
    const aplicarAnticipo = async () => {
        if (tipoFactura !== "venta") { errorToast("El anticipo solo aplica a ingresos de cliente"); return; }
        if (!docNit.trim()) { errorToast("Elige el cliente del anticipo"); return; }
        if (!(await confirm(`Se registrarán ${movimientoIdsManual.length} pago(s) por ${money(sumaMovManual)} como anticipo del cliente, sin aplicar a ninguna factura. Quedará como saldo a favor. ¿Continuar?`))) return;
        setApplying(true);
        try {
            const r = await registrarAnticipo(movimientoIdsManual, docNit.trim(), terceroNombre || undefined);
            successToast(r.message);
            cerrarModal();
            setSel(new Set()); setVerIguales(null);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo registrar el anticipo");
        } finally {
            setApplying(false);
        }
    };

    /** Busca terceros por nombre o NIT mientras se escribe (para no tener que saber el NIT). */
    const onTerceroInput = async (texto: string) => {
        setDocNit(texto);
        setDocs([]);
        if (texto.trim().length < 2) { setTercerosResult([]); return; }
        // Si parece un NIT (solo dígitos), busca directo sus documentos.
        if (/^\d{5,}$/.test(texto.trim())) { setTercerosResult([]); void buscarDocs(texto.trim()); return; }
        try {
            const r = await buscarTerceros(texto.trim(), tipoFactura);
            setTercerosResult(r.terceros);
        } catch { /* opcional */ }
    };
    /** Elige un tercero de los resultados: fija su NIT y trae sus documentos pendientes. */
    const elegirTercero = (t: { doc: string; nombre: string }) => {
        setDocNit(t.doc);
        setTerceroNombre(t.nombre);
        setTercerosResult([]);
        void buscarDocs(t.doc);
    };
    const cerrarModal = () => { setModalMov(null); setModalGroup(false); setTercerosResult([]); setAplicarRetencion(false); setTerceroNombre(""); };

    const sumaDocsSel = useMemo(() => docs.filter((d) => docSel.has(d.id)).reduce((s, d) => s + d.saldo, 0), [docs, docSel]);
    const movimientoIdsManual = modalGroup ? seleccionados.map((m) => m.asiento_id) : modalMov ? [modalMov.asiento_id] : [];
    const sumaMovManual = modalGroup ? sumaSel : modalMov ? Math.abs(modalMov.valor) : 0;
    // Diferencia: si la factura es MAYOR que el pago, esa diferencia puede ser la retención sufrida.
    const difManual = sumaDocsSel - sumaMovManual; // positivo = falta plata (posible retención)
    // Retención que se llevaría a la cuenta de retefuente sufrida (solo ventas, factura > pago).
    const retencionManual = aplicarRetencion && tipoFactura === "venta" && difManual > 0 ? Math.round(difManual * 100) / 100 : 0;
    const cuadra = Math.abs(sumaMovManual + retencionManual - sumaDocsSel) <= 100;

    const aplicarManual = async () => {
        const facturaIds = [...docSel];
        if (!facturaIds.length) { errorToast("Marca al menos una factura"); return; }
        setApplying(true);
        try {
            const r = await crearConciliacionManual(tipoFactura, movimientoIdsManual, facturaIds, retencionManual || undefined);
            // Crear deja la conciliación 'sugerido'; la confirmamos en seguida.
            await confirmarConciliacion(r.id);
            successToast(retencionManual > 0 ? `Conciliación aplicada (retención ${money(retencionManual)} llevada a retefuente).` : "Conciliación aplicada.");
            cerrarModal();
            setSel(new Set()); setVerIguales(null);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo conciliar");
        } finally {
            setApplying(false);
        }
    };

    const filterContent = (
        <>
            <FilterField label="Búsqueda" htmlFor="conc-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="conc-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Descripción o tercero"
                                        />
                                    </FilterField>
                                    <FilterField label="Sugerencias" htmlFor="conc-filter-sug" icon="ri-filter-3-line">
                                        <FieldControl
                                            as="select"
                                            id="conc-filter-sug"
                                            value={soloSugeridos ? "1" : ""}
                                            onChange={(e) => setSoloSugeridos(e.target.value === "1")}
                                        >
                                            <option value="">Todos los movimientos</option>
                                            <option value="1">Solo con sugerencia</option>
                                        </FieldControl>
                                    </FilterField>
                                    <FilterField label="Prioridad" htmlFor="conc-filter-alta" icon="ri-shield-check-line">
                                        <FieldControl
                                            as="select"
                                            id="conc-filter-alta"
                                            value={soloAlta ? "1" : ""}
                                            onChange={(e) => setSoloAlta(e.target.value === "1")}
                                        >
                                            <option value="">Todas las prioridades</option>
                                            <option value="1">Solo alta prioridad</option>
                                        </FieldControl>
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="conc-filters-heading" className="purchases-filters-panel__title">Filtrar movimientos</h2>
                {hasActiveFilters && (
                    <button type="button" className="purchases-filters-clear" onClick={clearFilters}>Limpiar</button>
                )}
            </div>
            <div className="purchases-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="purchases-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="purchases-filters-clear purchases-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="purchases-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`purchases-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="conc-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen && !isMobile && typeof document !== "undefined" && createPortal(
                    <div
                        ref={filtersPanelRef}
                        id="conc-filters-panel"
                        className="purchases-filters-panel purchases-filters-panel--floating"
                        style={filtersPanelStyle}
                        role="region"
                        aria-labelledby="conc-filters-heading"
                    >
                        {filtersPanelContent}
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <div className="purchases-sticky-head">
                    <ListPageHeader
                        className="purchases-header"
                        title="Conciliación bancaria"
                        subtitle="Todos los movimientos del banco. El sistema sugiere la factura que corresponde; confírmala o concilia manualmente."
                        actions={
                            <div className="cb-actions">
                                <button className="cb-btn" onClick={() => fileRef.current?.click()} disabled={importando} title="Importar extracto">
                                    <i className={importando ? "ri-loader-4-line rotating" : "ri-upload-2-line"} /> {importando ? "Importando…" : "Importar extracto"}
                                </button>
                                <input ref={fileRef} type="file" accept="application/pdf,.pdf,.xlsx,.xls,.csv" multiple hidden onChange={(e) => importar(e.target.files)} />
                                <button className="cb-btn cb-btn--primary" onClick={generar} disabled={generando}>
                                    <i className="ri-magic-line" /> {generando ? "Generando…" : "Generar sugerencias"}
                                </button>
                                <button className="cb-btn" onClick={abrirRecurrentes} title="Pagos recurrentes">
                                    <i className="ri-repeat-2-line" /> Pagos recurrentes
                                </button>
                                {conSug > 0 && (
                                    <button className="cb-btn cb-btn--primary" onClick={confirmarTodas} disabled={bulkBusy}>
                                        <i className="ri-check-double-line" /> {bulkBusy ? "Confirmando…" : `Confirmar todas (${conSug})`}
                                    </button>
                                )}
                            </div>
                        }
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar movimientos"
    ariaLabelledBy="conc-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                {/* Dos vistas como pestañas (no botones gigantes). */}
                <div className="cb-tabs">
                    <button className={`cb-tab${vista === "ingreso" ? " cb-tab--active" : ""}`} onClick={() => setVista("ingreso")}>
                        <i className="ri-arrow-down-circle-line" /> Ingresos (ventas)
                    </button>
                    <button className={`cb-tab${vista === "egreso" ? " cb-tab--active" : ""}`} onClick={() => setVista("egreso")}>
                        <i className="ri-arrow-up-circle-line" /> Egresos (compras)
                    </button>
                </div>

                <div className="cb-summary">
                    <span><strong>{total}</strong> movimiento(s)</span>
                    <span style={{ color: "var(--accent-teal)" }}><strong>{conSug}</strong> con sugerencia</span>
                    {seleccionados.length > 0 && <span style={{ color: "var(--accent-teal)" }}><strong>{seleccionados.length}</strong> seleccionado(s) · suma <strong>{money(sumaSel)}</strong></span>}
                    {filtroIguales && <span style={{ color: "#b45309" }}><i className="ri-filter-fill" /> Solo iguales a “{seleccionados[0]?.descripcion.slice(0, 26)}” ({movsVisibles.length})</span>}
                    {seleccionados.length > 0 && (
                        <div className="cb-summary__actions cb-summary__spacer">
                            <button className="cb-btn" onClick={() => { setSel(new Set()); setVerIguales(null); }}>Limpiar</button>
                            {seleccionados.some((m) => m.sugerencia) && (
                                <button className="cb-btn cb-btn--primary" onClick={confirmarSeleccionados} disabled={bulkBusy} title="Confirmar los seleccionados que tienen sugerencia, cada uno con su factura">
                                    <i className="ri-check-double-line" /> {bulkBusy ? "Confirmando…" : `Confirmar ${seleccionados.filter((m) => m.sugerencia).length} sugerida(s)`}
                                </button>
                            )}
                            <button className="cb-btn" onClick={abrirCuenta} title="Llevar estos movimientos a una cuenta contable (intereses, comisiones, etc.)"><i className="ri-bank-line" /> Enviar a cuenta contable</button>
                            <button className="cb-btn cb-btn--ia" onClick={sugerirCuenta} disabled={iaSugiriendo} title="La IA sugiere a qué cuenta del PUC corresponde este movimiento">
                                <i className="ri-sparkling-2-line" /> {iaSugiriendo ? "Pensando…" : "Sugerir cuenta (IA)"}
                            </button>
                            <button className="cb-btn" onClick={abrirGrupo}><i className="ri-links-line" /> Agrupar y conciliar</button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando…</div>
                ) : total === 0 ? (
                    <div className="purchases-empty"><i className="ri-bank-line"></i><p>No hay {vista === "ingreso" ? "ingresos" : "egresos"} por conciliar.</p></div>
                ) : (
                    <>
                        <PaginationToolbar
                            position="top"
                            page={safePage}
                            totalPages={totalPages}
                            totalItems={total}
                            pageSize={pageSize}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                            rangeStart={start}
                            rangeEnd={end}
                            isFetching={loading}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            showViewToggle
                            beforeViewToggle={filtersToolbar}
                        />
                        <ConciliacionMovListViews
                            movs={movsVisibles}
                            sel={sel}
                            busy={busy}
                            effectiveViewMode={effectiveViewMode}
                            onToggle={toggle}
                            onToggleAll={toggleAll}
                            onConfirmar={confirmar}
                            onRechazar={rechazar}
                            onAbrirManual={abrirManual}
                        />
                        <PaginationToolbar
                            position="bottom"
                            page={safePage}
                            totalPages={totalPages}
                            totalItems={total}
                            pageSize={pageSize}
                            rangeStart={start}
                            rangeEnd={end}
                            onPageChange={handlePageChange}
                            isFetching={loading}
                        />
                    </>
                )}
            </ListPageContainer>


            {/* Modal de conciliación manual / agrupación */}
            {(modalMov || modalGroup) && (
                <AppModal
                    title={`${modalGroup ? `Agrupar ${seleccionados.length} movimiento(s)` : "Conciliar movimiento"} · ${money(sumaMovManual)}`}
                    onClose={cerrarModal}
                    closeDisabled={applying}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={cerrarModal} disabled={applying}>Cancelar</button>
                            {tipoFactura === "venta" && docNit.trim() && (
                                <button type="button" className="export-cancel" onClick={aplicarAnticipo} disabled={applying} title="Registrar como saldo a favor del cliente, sin aplicar a una factura específica" style={{ borderColor: "var(--accent-teal)", color: "var(--accent-teal)" }}>
                                    <i className="ri-wallet-3-line" /> Registrar como anticipo
                                </button>
                            )}
                            <button type="button" className="export-submit" onClick={aplicarManual} disabled={applying || docSel.size === 0 || !cuadra}>{applying ? "Aplicando…" : "Conciliar y contabilizar"}</button>
                        </>
                    }
                >
                            <FilterField className="led-form-grid__full" label={`${tipoFactura === "venta" ? "Cliente" : "Proveedor"} (nombre o NIT)`} htmlFor="conc-tercero" icon="ri-user-search-line">
                                <FieldControl id="conc-tercero" value={docNit} onChange={(e) => onTerceroInput(e.target.value)} placeholder={`Escribe el nombre (ej. MAGNISEGUROS) o el NIT…`} autoFocus />
                            </FilterField>
                            {/* Resultados de la búsqueda por nombre: elige el tercero. */}
                            {tercerosResult.length > 0 && (
                                <div className="cb-doc-wrap" style={{ marginBottom: 10 }}>
                                    <table className="cb-doc-table">
                                        <thead><tr><th>NIT</th><th>Nombre</th></tr></thead>
                                        <tbody>
                                            {tercerosResult.map((t) => (
                                                <tr key={t.doc} onClick={() => elegirTercero(t)}>
                                                    <td>{t.doc}</td>
                                                    <td>{t.nombre}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {docs.length === 0 ? (
                                <p className="pm-hint">Escribe el nombre o NIT y elige el {tipoFactura === "venta" ? "cliente" : "proveedor"} para ver sus documentos pendientes.</p>
                            ) : (
                                <div className="cb-doc-wrap">
                                <table className="cb-doc-table">
                                    <thead><tr>
                                        <th style={{ width: 36 }}>
                                            <input
                                                type="checkbox"
                                                checked={docs.length > 0 && docs.every((d) => docSel.has(d.id))}
                                                onChange={() => setDocSel((prev) => (docs.every((d) => prev.has(d.id)) ? new Set() : new Set(docs.map((d) => d.id))))}
                                                title="Seleccionar todas las facturas"
                                            />
                                        </th>
                                        <th>Documento</th><th className="cb-doc-col-saldo">Saldo</th>
                                    </tr></thead>
                                    <tbody>
                                        {docs.map((d) => (
                                            <tr key={d.id} className={docSel.has(d.id) ? "is-sel" : ""} onClick={() => setDocSel((prev) => { const n = new Set(prev); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}>
                                                <td><input type="checkbox" checked={docSel.has(d.id)} readOnly /></td>
                                                <td>{d.numero}</td>
                                                <td className="cb-doc-col-saldo">{money(d.saldo)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}
                            {/* Suma en vivo */}
                            <div className="pm-hint" style={{ marginTop: 10 }}>
                                Pago: <strong>{money(sumaMovManual)}</strong> · Facturas: <strong>{money(sumaDocsSel)}</strong>
                                {retencionManual > 0 && <> · Retención: <strong style={{ color: "#b45309" }}>{money(retencionManual)}</strong></>}
                                {" · "}Diferencia: <strong style={{ color: cuadra ? "var(--accent-teal)" : "var(--tertiary-color)" }}>{money(sumaMovManual + retencionManual - sumaDocsSel)}</strong>
                                {!cuadra && docSel.size > 0 && !aplicarRetencion && <span style={{ color: "var(--tertiary-color)" }}> — debe cuadrar (±100) para conciliar.</span>}
                            </div>
                            {/* Opción retención: cuando la factura es mayor que el pago (ventas), el resto es la retención sufrida. */}
                            {tipoFactura === "venta" && difManual > 100 && docSel.size > 0 && (
                                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer", fontSize: ".88rem" }}>
                                    <input type="checkbox" checked={aplicarRetencion} onChange={(e) => setAplicarRetencion(e.target.checked)} />
                                    El cliente practicó retención: llevar la diferencia <strong style={{ color: "#b45309" }}>{money(difManual)}</strong> a retención en la fuente y dejar la factura pagada.
                                </label>
                            )}
                </AppModal>
            )}

            {/* Modal: enviar a una cuenta contable directa (no cartera) */}
            {cuentaModal && (
                <AppModal
                    wide
                    title={`Enviar ${grupoCuenta ? `${grupoCuenta.ids.length} pago(s) recurrentes (${money(grupoCuenta.valor)} c/u)` : cuentaEnviarTodos && conceptoActivo && total > seleccionados.length ? `TODOS los “${conceptoActivo.slice(0, 24)}” (${total})` : `${seleccionados.length} movimiento(s)`} a una cuenta`}
                    onClose={cerrarCuentaModal}
                    closeDisabled={applying}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={cerrarCuentaModal} disabled={applying}>Cancelar</button>
                            <button type="button" className="export-submit" onClick={aplicarACuenta} disabled={applying || !cuentaSel}>{applying ? "Aplicando…" : "Llevar a la cuenta"}</button>
                        </>
                    }
                >
                            <p className="pm-hint">Para movimientos que no son cartera (intereses, comisiones, impuestos…). Se contabiliza directo a la cuenta que elijas.</p>
                            {/* Sugerencia de IA */}
                            {iaSugiriendo && (
                                <div className="cb-ia-card cb-ia-card--loading">
                                    <i className="ri-sparkling-2-line cb-ia-spin" /> La IA está analizando “{(grupoCuenta?.concepto ?? seleccionados[0]?.descripcion ?? "").slice(0, 40)}”…
                                </div>
                            )}
                            {iaSugerencia && !iaSugiriendo && (
                                <div className="cb-ia-card">
                                    <div className="cb-ia-card__head"><i className="ri-sparkling-2-line" /> Sugerencia de IA</div>
                                    {iaSugerencia.cuenta ? (
                                        <>
                                            <p className="cb-ia-card__cuenta"><strong>{iaSugerencia.cuenta.codigo}</strong> — {iaSugerencia.cuenta.nombre}</p>
                                            {iaSugerencia.concepto && <p className="cb-ia-card__meta">Concepto: {iaSugerencia.concepto}{iaSugerencia.confianza ? ` · confianza ${iaSugerencia.confianza}` : ""}</p>}
                                            {iaSugerencia.razonamiento && <p className="cb-ia-card__razon">{iaSugerencia.razonamiento}</p>}
                                            <p className="cb-ia-card__note">Ya quedó precargada abajo. Revísala y contabiliza, o búscala manualmente.</p>
                                        </>
                                    ) : (
                                        <p className="cb-ia-card__razon">{iaSugerencia.advertencia || "La IA no pudo proponer una cuenta clara. Búscala manualmente."}</p>
                                    )}
                                </div>
                            )}
                            {!grupoCuenta && conceptoActivo && total > seleccionados.length && (
                                <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px", cursor: "pointer", fontSize: ".88rem" }}>
                                    <input type="checkbox" checked={cuentaEnviarTodos} onChange={(e) => setCuentaEnviarTodos(e.target.checked)} />
                                    Enviar <strong>TODOS</strong> los “{conceptoActivo.slice(0, 26)}” ({total}), no solo los {seleccionados.length} seleccionados.
                                </label>
                            )}
                            {grupoCuenta && (
                                <p className="pm-hint" style={{ color: "#6d28d9" }}>
                                    <i className="ri-repeat-2-line" /> Se llevarán los <strong>{grupoCuenta.ids.length}</strong> pagos recurrentes de “{grupoCuenta.concepto.slice(0, 30)}” ({money(grupoCuenta.valor)} c/u) a esta cuenta.
                                </p>
                            )}
                            <FilterField className="led-form-grid__full" label="Buscar cuenta del PUC" htmlFor="conc-cuenta-search" icon="ri-search-line">
                                <FieldControl
                                    id="conc-cuenta-search"
                                    value={cuentaSearch}
                                    onChange={(e) => { setCuentaSearch(e.target.value); buscarCuentas(e.target.value); }}
                                    placeholder="Código o nombre (ej. 421005, intereses, comisión)…"
                                    autoFocus
                                />
                            </FilterField>
                            {cuentaSel && (
                                <p style={{ color: "var(--accent-teal)", fontWeight: 600 }}>
                                    <i className="ri-check-line" /> {cuentaSel.codigo} — {cuentaSel.nombre}
                                </p>
                            )}
            {/* "No se encontró" solo si NO hay cuenta seleccionada ni se está creando una. */}
                            {cuentaSearch.trim().length >= 2 && cuentaResultados.length === 0 && !cuentaSel && !crearForm && (
                                <div style={{ color: "var(--tertiary-color)", margin: "6px 0" }}>
                                    <p style={{ margin: 0 }}>
                                        <i className="ri-error-warning-line" /> No se encontró ninguna cuenta de movimiento con “{cuentaSearch.trim()}”.
                                    </p>
                                    <button className="cb-btn cb-btn--primary" style={{ marginTop: 8 }} onClick={abrirCrearCuenta}>
                                        <i className="ri-add-circle-line" /> Crear cuenta “{cuentaSearch.trim()}”
                                    </button>
                                </div>
                            )}
                            {/* Formulario para crear la cuenta en el PUC. */}
                            {crearForm && (
                                <div className="cb-ia-card" style={{ borderColor: "var(--accent-teal)", background: "var(--card-bg)" }}>
                                    <div className="cb-ia-card__head" style={{ color: "var(--accent-teal)" }}><i className="ri-add-circle-line" /> Crear cuenta en el PUC</div>
                                    <div className="led-form-grid">
                                        <FilterField label="Código (solo dígitos)" htmlFor="conc-crear-codigo" icon="ri-hashtag">
                                            <FieldControl id="conc-crear-codigo" value={crearForm.codigo} onChange={(e) => setCrearForm({ ...crearForm, codigo: e.target.value.replace(/\D/g, "") })} placeholder="Ej. 53052501" />
                                        </FilterField>
                                        <FilterField label="Nombre" htmlFor="conc-crear-nombre" icon="ri-file-text-line">
                                            <FieldControl id="conc-crear-nombre" value={crearForm.nombre} onChange={(e) => setCrearForm({ ...crearForm, nombre: e.target.value })} placeholder="Ej. Comisiones bancarias" />
                                        </FilterField>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                        <button className="pm-cancel" onClick={() => setCrearForm(null)} disabled={creandoCuenta}>Cancelar</button>
                                        <button className="pm-submit" onClick={crearCuenta} disabled={creandoCuenta || !crearForm.codigo || !crearForm.nombre.trim()}>
                                            {creandoCuenta ? "Creando…" : "Crear y usar"}
                                        </button>
                                    </div>
                                    <p className="cb-ia-card__meta" style={{ marginTop: 6 }}>Se crea como cuenta de movimiento (auxiliar). La naturaleza se deduce del primer dígito.</p>
                                </div>
                            )}
                            {cuentaResultados.length > 0 && !cuentaSel && (
                                <p className="pm-hint">Haz clic en la cuenta correcta:</p>
                            )}
                            {cuentaResultados.length > 0 && (
                                <div className="cb-doc-wrap">
                                <table className="cb-doc-table">
                                    <thead><tr><th>Código</th><th>Nombre</th></tr></thead>
                                    <tbody>
                                        {cuentaResultados.map((c) => (
                                            <tr key={c.codigo} className={cuentaSel?.codigo === c.codigo ? "is-sel" : ""} onClick={() => setCuentaSel({ codigo: c.codigo, nombre: c.nombre })}>
                                                <td>{c.codigo}</td>
                                                <td>{c.nombre}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            )}

                            {/* Detalle del banco: solo aplica para Intereses financieros (42100501). */}
                            {cuentaSel?.codigo === "42100501" && (
                                <div style={{ borderTop: "1px solid var(--border-light)", marginTop: 12, paddingTop: 10 }}>
                                    <p className="pm-hint" style={{ marginBottom: 6 }}><i className="ri-bank-line" /> Banco que pagó los intereses (tercero del ingreso financiero)</p>
                                    <div className="led-form-grid">
                                        <FilterField label="Banco" htmlFor="conc-banco-nombre" icon="ri-bank-line">
                                            <>
                                                <FieldControl id="conc-banco-nombre" list="conc-bancos" value={bancoTexto} onChange={(e) => onBancoChange(e.target.value)} placeholder="Escribe el banco (ej. BANCOLOMBIA)…" />
                                                <datalist id="conc-bancos">
                                                    {catalogoBancos.map((b) => <option key={b.nombre} value={b.nombre} />)}
                                                </datalist>
                                            </>
                                        </FilterField>
                                        <FilterField label="NIT del banco" htmlFor="conc-banco-nit" icon="ri-id-card-line">
                                            <FieldControl id="conc-banco-nit" value={bancoNit} onChange={(e) => setBancoNit(e.target.value)} placeholder="Se completa solo" />
                                        </FilterField>
                                    </div>
                                </div>
                            )}
                </AppModal>
            )}

            {/* Modal: pagos recurrentes detectados */}
            {recurrentesModal && (
                <AppModal
                    wide
                    title={`Pagos recurrentes — ${vista === "ingreso" ? "Ingresos" : "Egresos"}`}
                    onClose={() => setRecurrentesModal(false)}
                    footer={<button type="button" className="export-cancel" onClick={() => setRecurrentesModal(false)}>Cerrar</button>}
                >
                            <p className="pm-hint">Pagos que se repiten (mismo concepto y valor) en varios meses — nómina, arriendos, cuotas fijas. Selecciona uno para llevar TODOS sus movimientos a una cuenta de una vez.</p>
                            {cargandoRec ? (
                                <p className="pm-hint"><i className="ri-loader-4-line rotating" /> Analizando los movimientos…</p>
                            ) : recurrentes.length === 0 ? (
                                <p className="pm-hint">No se encontraron pagos recurrentes (que se repitan 3 veces o más).</p>
                            ) : (
                                <div className="cb-doc-wrap" style={{ maxHeight: 420 }}>
                                    <table className="cb-doc-table">
                                        <thead><tr><th>Concepto</th><th className="cb-doc-col-saldo">Valor c/u</th><th style={{ textAlign: "center" }}>Veces</th><th>Periodo</th><th className="cb-doc-col-saldo">Total</th><th></th></tr></thead>
                                        <tbody>
                                            {recurrentes.map((g, i) => (
                                                <tr key={i}>
                                                    <td>{g.concepto}</td>
                                                    <td className="cb-doc-col-saldo">{money(g.valor)}</td>
                                                    <td style={{ textAlign: "center" }}><span className="status-badge" style={{ background: "rgba(124,58,237,.12)", color: "#6d28d9" }}>{g.veces}× · {g.meses} meses</span></td>
                                                    <td style={{ fontSize: ".78rem", color: "var(--tertiary-color)" }}>{fdate(g.desde)} → {fdate(g.hasta)}</td>
                                                    <td className="cb-doc-col-saldo"><strong>{money(g.total)}</strong></td>
                                                    <td><button className="cb-btn cb-btn--primary" style={{ padding: "4px 10px", fontSize: ".8rem" }} onClick={() => enviarGrupoACuenta(g)} title="Llevar los {g.veces} pagos de este concepto a una cuenta contable"><i className="ri-bank-line" /> Enviar a cuenta</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                </AppModal>
            )}
        </ListPageShell>
    );
};

export default ConciliacionBancariaPage;
