import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { LedgerChip, LedgerChipRow, LedgerPrimaryBtn, LedgerRow, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { API_ROUTES } from "../../../utils/global";
import { downloadFromUrl } from "../../../utils/downloadFromUrl.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { fdate, money } from "../../ledger/ledger.shared";
import {
  deleteCredential,
  deleteSyncJob,
  DIAN_EVENT_LABELS,
  DIAN_GROUP_LABELS,
  enrichSyncJob,
  isDianModuleUnavailable,
  listCredentials,
  listEvents,
  listLogs,
  listSyncDocuments,
  listSyncJobs,
  triggerSync,
  upsertCredential,
  validateCredential,
  type DianCredential,
  type DianDocument,
  type DianEvent,
  type DianLog,
  type DianSyncGroup,
  type DianSyncJob,
} from "../../../services/dian.service";

type Tab = "sync" | "documents" | "events" | "logs";
const PAGE_SIZE = 20;

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthAgoISO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

const fmtDateTime = (value?: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
};

const syncStatusLabel: Record<string, string> = {
  queued: "En cola",
  running: "Procesando",
  completed: "Completado",
  failed: "Fallido",
};

const statusTone = (s: string) =>
  s === "completed" ? "ok" : s === "failed" ? "bad" : s === "running" ? "warn" : "neutral";

export default function DianSyncNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [tab, setTab] = useState<Tab>("sync");
  const [moduleAvailable, setModuleAvailable] = useState(true);
  const [credentials, setCredentials] = useState<DianCredential[]>([]);
  const [credLoading, setCredLoading] = useState(true);
  const [jobs, setJobs] = useState<DianSyncJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [documents, setDocuments] = useState<DianDocument[]>([]);
  const [docsPage, setDocsPage] = useState(1);
  const [docsTotal, setDocsTotal] = useState(0);
  const [docsLoading, setDocsLoading] = useState(false);
  const [events, setEvents] = useState<DianEvent[]>([]);
  const [logs, setLogs] = useState<DianLog[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [syncModal, setSyncModal] = useState(false);
  const [credModal, setCredModal] = useState(false);
  const [accessUrl, setAccessUrl] = useState("");
  const [credLabel, setCredLabel] = useState("");

  const [syncCredId, setSyncCredId] = useState("");
  const [fromDate, setFromDate] = useState(monthAgoISO());
  const [toDate, setToDate] = useState(todayISO());
  const [group, setGroup] = useState<DianSyncGroup>("all");

  const docsTotalPages = Math.max(1, Math.ceil(docsTotal / PAGE_SIZE));
  const selectedJob = jobs.find((j) => j._id === selectedJobId) || null;

  const loadCredentials = useCallback(async () => {
    setCredLoading(true);
    try {
      const res = await listCredentials();
      setCredentials(res.credentials);
      setModuleAvailable(true);
      if (!syncCredId && res.credentials[0]) setSyncCredId(res.credentials[0]._id);
    } catch (error) {
      if (isDianModuleUnavailable(error)) {
        setModuleAvailable(false);
        setCredentials([]);
      } else {
        errorToast(error instanceof Error ? error.message : "Error al cargar credenciales");
      }
    } finally {
      setCredLoading(false);
    }
  }, [syncCredId]);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await listSyncJobs(1, PAGE_SIZE);
      setJobs(res.jobs);
      if (!selectedJobId && res.jobs[0]) setSelectedJobId(res.jobs[0]._id);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar sincronizaciones");
    } finally {
      setJobsLoading(false);
    }
  }, [selectedJobId]);

  const loadDocuments = useCallback(async () => {
    if (!selectedJobId) return;
    setDocsLoading(true);
    try {
      const res = await listSyncDocuments(selectedJobId, { page: docsPage, pageSize: PAGE_SIZE });
      setDocuments(res.documents);
      setDocsTotal(res.total);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar documentos");
    } finally {
      setDocsLoading(false);
    }
  }, [selectedJobId, docsPage]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await listEvents();
      setEvents(res.events);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar eventos");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await listLogs(1, 30);
      setLogs(res.logs);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar logs");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredentials();
    loadJobs();
  }, []);

  useEffect(() => {
    if (tab === "documents") loadDocuments();
    if (tab === "events") loadEvents();
    if (tab === "logs") loadLogs();
  }, [tab, loadDocuments, loadEvents, loadLogs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCredentials(), loadJobs()]);
    if (tab === "documents") await loadDocuments();
    if (tab === "events") await loadEvents();
    if (tab === "logs") await loadLogs();
    setRefreshing(false);
  };

  const onValidateCred = async (id: string) => {
    setBusy(id);
    try {
      await validateCredential(id);
      successToast("Credencial válida");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy("");
    }
  };

  const onDeleteCred = (c: DianCredential) => {
    Alert.alert("Eliminar credencial", `¿Eliminar ${c.label || c.nit}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setBusy(c._id);
          try {
            await deleteCredential(c._id);
            successToast("Credencial eliminada");
            loadCredentials();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          } finally {
            setBusy("");
          }
        },
      },
    ]);
  };

  const onAddCred = async () => {
    if (!accessUrl.trim()) {
      errorToast("Pega la URL de acceso DIAN");
      return;
    }
    setBusy("cred");
    try {
      await upsertCredential(accessUrl.trim(), credLabel.trim() || undefined);
      successToast("Credencial registrada");
      setCredModal(false);
      setAccessUrl("");
      setCredLabel("");
      loadCredentials();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy("");
    }
  };

  const onStartSync = async () => {
    if (!syncCredId) {
      errorToast("Selecciona una credencial");
      return;
    }
    if (fromDate > toDate) {
      errorToast("Rango de fechas inválido");
      return;
    }
    setBusy("sync");
    try {
      const res = await triggerSync({ credentialId: syncCredId, fromDate, toDate, group });
      successToast("Sincronización iniciada");
      setSyncModal(false);
      setSelectedJobId(res.jobId);
      loadJobs();
      setTab("documents");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy("");
    }
  };

  const onDeleteJob = (job: DianSyncJob) => {
    Alert.alert("Eliminar job", "¿Eliminar esta sincronización?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setBusy(job._id);
          try {
            await deleteSyncJob(job._id);
            successToast("Eliminado");
            if (selectedJobId === job._id) setSelectedJobId("");
            loadJobs();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          } finally {
            setBusy("");
          }
        },
      },
    ]);
  };

  const onDownloadExcel = async (jobId: string) => {
    setBusy(`x-${jobId}`);
    try {
      await downloadFromUrl(API_ROUTES.DIAN_SYNC_EXCEL(jobId), `dian-export-${jobId}.xlsx`);
      successToast("Excel listo para compartir");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy("");
    }
  };

  const onDownloadPdfs = async (jobId: string) => {
    setBusy(`p-${jobId}`);
    try {
      await downloadFromUrl(API_ROUTES.DIAN_SYNC_DOWNLOAD_PDFS(jobId), `dian-pdfs-${jobId}.zip`, "application/zip");
      successToast("ZIP listo para compartir");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy("");
    }
  };

  const onEnrich = async (jobId: string) => {
    setBusy(`e-${jobId}`);
    try {
      const res = await enrichSyncJob(jobId);
      successToast(res.message);
      loadJobs();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy("");
    }
  };

  const onOpenPdf = async (docId: string) => {
    setBusy(`d-${docId}`);
    try {
      await downloadFromUrl(API_ROUTES.DIAN_DOCUMENT_PDF(docId), `dian-doc-${docId}.pdf`, "application/pdf");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al abrir PDF");
    } finally {
      setBusy("");
    }
  };

  if (!moduleAvailable) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBg, padding: 24 }]}>
        <Text style={{ color: colors.textMuted, textAlign: "center" }}>
          El módulo de sincronización DIAN no está configurado en el servidor.
        </Text>
      </View>
    );
  }

  return (
    <>
    <DsModuleScreen
      title="Sincronización DIAN"
      subtitle="Credenciales, jobs de sync, documentos y eventos"
      noScroll
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={{ borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }}
      >
        {(["sync", "documents", "events", "logs"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              tab === t ? { backgroundColor: colors.headerAccent, borderColor: colors.headerAccent } : { borderColor: colors.border },
            ]}
          >
            <Text style={{ color: tab === t ? "#fff" : colors.textMuted, fontWeight: "600", fontSize: 13 }}>
              {t === "sync" ? "Sync" : t === "documents" ? "Documentos" : t === "events" ? "Eventos" : "Logs"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === "sync" ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.primary }]}>Credenciales</Text>
              {credLoading ? (
                <ActivityIndicator />
              ) : credentials.length === 0 ? (
                <Text style={{ color: colors.textMuted }}>Sin credenciales. Agrega una URL de acceso DIAN.</Text>
              ) : (
                credentials.map((c) => (
                  <View key={c._id} style={{ marginBottom: 10 }}>
                    <LedgerRow
                      cells={[
                        { value: c.label || c.nit, bold: true },
                        { value: fmtDateTime(c.token_expires_at), align: "right" },
                      ]}
                    />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      <LedgerPrimaryBtn label="Validar" variant="secondary" onPress={() => onValidateCred(c._id)} loading={busy === c._id} />
                      <LedgerPrimaryBtn label="Eliminar" variant="danger" onPress={() => onDeleteCred(c)} disabled={!!busy} />
                    </View>
                  </View>
                ))
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <LedgerPrimaryBtn label="Agregar credencial" onPress={() => setCredModal(true)} />
                <LedgerPrimaryBtn label="Nueva sync" onPress={() => setSyncModal(true)} disabled={!credentials.length} />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.primary }]}>Jobs de sincronización</Text>
              {jobsLoading ? (
                <ActivityIndicator />
              ) : jobs.length === 0 ? (
                <Text style={{ color: colors.textMuted }}>Sin sincronizaciones aún.</Text>
              ) : (
                jobs.map((j) => (
                  <View key={j._id} style={{ marginBottom: 12 }}>
                    <LedgerRow
                      cells={[
                        { value: fmtDateTime(j.created), bold: true },
                        { value: syncStatusLabel[j.status] || j.status, align: "right" },
                      ]}
                    />
                    <LedgerStatusBadge label={syncStatusLabel[j.status] || j.status} tone={statusTone(j.status)} />
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginVertical: 4 }}>
                      {j.filters.fromDate} → {j.filters.toDate} · {DIAN_GROUP_LABELS[j.filters.group || "all"]} ·{" "}
                      {j.total_imported} importados
                    </Text>
                    {j.progress ? <Text style={{ fontSize: 12 }}>{j.progress}</Text> : null}
                    {j.error_message ? <Text style={{ color: "#dc2626", fontSize: 12 }}>{j.error_message}</Text> : null}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      <LedgerPrimaryBtn label="Docs" variant="secondary" onPress={() => { setSelectedJobId(j._id); setTab("documents"); }} />
                      {j.status === "completed" ? (
                        <>
                          <LedgerPrimaryBtn label="Excel" variant="secondary" onPress={() => onDownloadExcel(j._id)} loading={busy === `x-${j._id}`} />
                          <LedgerPrimaryBtn label="PDFs" variant="secondary" onPress={() => onDownloadPdfs(j._id)} loading={busy === `p-${j._id}`} />
                          <LedgerPrimaryBtn label="Enriquecer" variant="secondary" onPress={() => onEnrich(j._id)} loading={busy === `e-${j._id}`} />
                        </>
                      ) : null}
                      <LedgerPrimaryBtn label="Eliminar" variant="danger" onPress={() => onDeleteJob(j)} disabled={!!busy} />
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {tab === "documents" ? (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>Documentos sincronizados</Text>
            {jobs.length ? (
              <LedgerChipRow>
                {jobs.slice(0, 8).map((j) => (
                  <LedgerChip
                    key={j._id}
                    label={fmtDateTime(j.created)}
                    active={selectedJobId === j._id}
                    onPress={() => {
                      setSelectedJobId(j._id);
                      setDocsPage(1);
                    }}
                  />
                ))}
              </LedgerChipRow>
            ) : null}
            {!selectedJob ? (
              <Text style={{ color: colors.textMuted }}>Selecciona un job de sincronización.</Text>
            ) : docsLoading ? (
              <ActivityIndicator />
            ) : documents.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sin documentos en este job.</Text>
            ) : (
              documents.map((d) => (
                <View key={d._id} style={{ marginBottom: 10 }}>
                  <LedgerRow
                    cells={[
                      { value: `${d.prefijo || ""}${d.folio || d.cufe.slice(0, 8)}`, bold: true },
                      { value: money(d.total), align: "right" },
                    ]}
                  />
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    {d.nombre_emisor || d.nit_emisor} · {fdate(d.fecha_emision)}
                  </Text>
                  {d.pdf_file_path ? (
                    <LedgerPrimaryBtn label="Ver PDF" variant="secondary" onPress={() => onOpenPdf(d._id)} loading={busy === `d-${d._id}`} />
                  ) : null}
                </View>
              ))
            )}
            <NativePagination page={docsPage} totalPages={docsTotalPages} loading={docsLoading} onChange={setDocsPage} />
          </View>
        ) : null}

        {tab === "events" ? (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>Eventos DIAN</Text>
            {eventsLoading ? (
              <ActivityIndicator />
            ) : events.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sin eventos registrados.</Text>
            ) : (
              events.map((ev) => (
                <LedgerRow
                  key={ev._id}
                  cells={[
                    { value: DIAN_EVENT_LABELS[ev.event_code], bold: true },
                    { value: ev.status, align: "right" },
                  ]}
                />
              ))
            )}
          </View>
        ) : null}

        {tab === "logs" ? (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>Auditoría</Text>
            {logsLoading ? (
              <ActivityIndicator />
            ) : logs.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sin logs.</Text>
            ) : (
              logs.map((l) => (
                <View key={l._id} style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: "600", color: colors.primaryText }}>{l.event}</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>{fmtDateTime(l.createdAt)}</Text>
                  {l.message ? <Text style={{ fontSize: 13 }}>{l.message}</Text> : null}
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </DsModuleScreen>

      <Modal visible={credModal} animationType="slide" transparent onRequestClose={() => setCredModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>Credencial DIAN</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
              Pega la URL de acceso del portal DIAN (token PK/RK).
            </Text>
            <TextInput
              value={accessUrl}
              onChangeText={setAccessUrl}
              placeholder="https://..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.primaryText }]}
              autoCapitalize="none"
            />
            <TextInput
              value={credLabel}
              onChangeText={setCredLabel}
              placeholder="Etiqueta (opcional)"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.primaryText, marginTop: 8 }]}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <LedgerPrimaryBtn label="Cancelar" variant="secondary" onPress={() => setCredModal(false)} />
              <LedgerPrimaryBtn label="Guardar" onPress={onAddCred} loading={busy === "cred"} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={syncModal} animationType="slide" transparent onRequestClose={() => setSyncModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.cardTitle, { color: colors.primary }]}>Nueva sincronización</Text>
            <LedgerChipRow>
              {credentials.map((c) => (
                <LedgerChip
                  key={c._id}
                  label={c.label || c.nit}
                  active={syncCredId === c._id}
                  onPress={() => setSyncCredId(c._id)}
                />
              ))}
            </LedgerChipRow>
            <TextInput value={fromDate} onChangeText={setFromDate} placeholder="Desde YYYY-MM-DD" style={[styles.input, { borderColor: colors.border, color: colors.primaryText, marginTop: 8 }]} />
            <TextInput value={toDate} onChangeText={setToDate} placeholder="Hasta YYYY-MM-DD" style={[styles.input, { borderColor: colors.border, color: colors.primaryText, marginTop: 8 }]} />
            <LedgerChipRow>
              {(Object.keys(DIAN_GROUP_LABELS) as DianSyncGroup[]).map((g) => (
                <LedgerChip key={g} label={DIAN_GROUP_LABELS[g]} active={group === g} onPress={() => setGroup(g)} />
              ))}
            </LedgerChipRow>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <LedgerPrimaryBtn label="Cancelar" variant="secondary" onPress={() => setSyncModal(false)} />
              <LedgerPrimaryBtn label="Iniciar" onPress={onStartSync} loading={busy === "sync"} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabs: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.card,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalBox: { padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "85%" },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.input, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14 },
});
