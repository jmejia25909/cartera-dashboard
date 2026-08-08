import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardExecutiveStats } from "../types/dashboardExecutive";
import type { CollectionPeriodReconciliation, CollectionReconciliationResult } from "../types/collectionReconciliation";
import { fmtMoney } from "../utils";
import "./abonos.css";

export interface AbonoItem {
  id: number | string;
  fecha: string;
  cliente?: string;
  razon_social?: string;
  documento: string;
  total_anterior: number;
  total_nuevo: number;
  observacion?: string;
  estado?: string;
  reversado?: number;
  motivo_reversion?: string;
}

export interface AbonosPageProps {
  abonos: AbonoItem[];
  fechaDesde: string;
  fechaHasta: string;
  onFechaDesdeChange: (value: string) => void;
  onFechaHastaChange: (value: string) => void;
  onExportPdf: () => Promise<void>;
  onReconciled?: () => Promise<void> | void;
}

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const parseMoney = (value: string): number | null => {
  const raw = value.trim().replace(/\s+/g, "").replace(/\./g, "").replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const formatDateTime = (value: string): string => {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export function AbonosPage({ abonos, fechaDesde, fechaHasta, onFechaDesdeChange, onFechaHastaChange, onExportPdf, onReconciled }: AbonosPageProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stats, setStats] = useState<DashboardExecutiveStats | null>(null);
  const [reconciliation, setReconciliation] = useState<CollectionPeriodReconciliation | null>(null);
  const [officialValue, setOfficialValue] = useState("");
  const [observation, setObservation] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const api = window.carteraApi;

  const loadPeriod = useCallback(async () => {
    if (!api?.dashboardExecutiveStats || !api?.collectionReconciliationGet) {
      setMessage("La conciliación está disponible únicamente en la aplicación de escritorio.");
      setMessageTone("info");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const [periodStats, reconciliationResult] = await Promise.all([
        api.dashboardExecutiveStats({ year, month }),
        api.collectionReconciliationGet({ year, month }),
      ]);
      setStats(periodStats);
      const result = reconciliationResult as CollectionReconciliationResult;
      if (!result.ok) throw new Error(result.message || "No fue posible consultar la conciliación.");
      const row = result.row || null;
      setReconciliation(row);
      if (row) {
        setOfficialValue(new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.officialValue));
        setObservation(row.observation || "");
      } else {
        setOfficialValue("");
        setObservation("");
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Error cargando la conciliación del período.");
      setMessageTone("error");
    } finally { setLoading(false); }
  }, [api, year, month]);

  useEffect(() => { void loadPeriod(); }, [loadPeriod]);

  const detected = stats?.cobrosMes.totalDetectado ?? 0;
  const movements = stats?.cobrosMes.movimientosDetectados ?? 0;
  const parsedOfficial = parseMoney(officialValue);
  const shownOfficial = reconciliation?.officialValue ?? parsedOfficial ?? 0;
  const difference = shownOfficial - detected;
  const isReconciled = stats?.cobrosMes.estado === "CONCILIADO" && stats?.cobrosMes.valorOficial !== null;

  const saveReconciliation = async (): Promise<void> => {
    if (!api?.collectionReconciliationSave) {
      setMessage("La conciliación está disponible únicamente en la aplicación de escritorio.");
      setMessageTone("error");
      return;
    }
    const official = parseMoney(officialValue);
    if (official === null) {
      setMessage("Ingresa un valor oficial válido mayor o igual a cero.");
      setMessageTone("error");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.collectionReconciliationSave({ year, month, officialValue: official, observation: observation.trim(), user: "sistema" });
      if (!result.ok) throw new Error(result.message || "No fue posible guardar la conciliación.");
      setMessage("Período conciliado correctamente.");
      setMessageTone("success");
      await loadPeriod();
      await onReconciled?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Error guardando la conciliación.");
      setMessageTone("error");
    } finally { setSaving(false); }
  };

  const filtered = useMemo(() => abonos.filter((abono) => {
    const applied = Number(abono.total_anterior || 0) - Number(abono.total_nuevo || 0);
    if (abono.reversado === 1 || abono.estado === "REVERSADO" || applied <= 0) return false;
    if (fechaDesde && (!abono.fecha || abono.fecha < fechaDesde)) return false;
    if (fechaHasta) {
      const hasta = fechaHasta.length === 10 ? `${fechaHasta}T23:59:59` : fechaHasta;
      if (!abono.fecha || abono.fecha > hasta) return false;
    }
    return true;
  }), [abonos, fechaDesde, fechaHasta]);

  const years = useMemo(() => {
    const values = new Set<number>([now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1, year]);
    for (const available of stats?.periodo.availableYears ?? []) values.add(available);
    return Array.from(values).sort((a,b)=>b-a);
  }, [stats, year]);

  return (
    <div className="collections-page">
      <section className="collections-reconciliation-card">
        <div className="collections-reconciliation-header">
          <div><div className="collections-eyebrow">ABONOS Y CONCILIACIÓN</div><h2>Conciliación de cobros</h2><p>Compara los movimientos detectados con el valor oficial confirmado para cada período.</p></div>
          <div className={isReconciled ? "collections-status collections-status--success" : "collections-status collections-status--warning"}><span className="collections-status-dot" />{isReconciled ? "CONCILIADO" : "REQUIERE CONCILIACIÓN"}</div>
        </div>
        <div className="collections-period-row">
          <label className="collections-field"><span>Año</span><select value={year} onChange={(e)=>setYear(Number(e.target.value))} disabled={loading||saving}>{years.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className="collections-field"><span>Mes</span><select value={month} onChange={(e)=>setMonth(Number(e.target.value))} disabled={loading||saving}>{MONTHS.map((label,i)=><option key={label} value={i+1}>{label}</option>)}</select></label>
          <button type="button" className="btn secondary collections-refresh" onClick={()=>void loadPeriod()} disabled={loading||saving}>{loading ? "Actualizando..." : "Actualizar período"}</button>
        </div>
        <div className="collections-metrics">
          <article className="collections-metric"><span>Detectado por sistema</span><strong>{fmtMoney(detected)}</strong><small>Movimientos inferidos del período</small></article>
          <article className="collections-metric collections-metric--official"><span>Valor oficial</span><strong>{isReconciled ? fmtMoney(stats?.cobrosMes.valorOficial ?? 0) : "Pendiente"}</strong><small>Valor confirmado mediante conciliación</small></article>
          <article className={Math.abs(difference)<=0.01 ? "collections-metric collections-metric--balanced" : "collections-metric collections-metric--difference"}><span>Diferencia</span><strong>{fmtMoney(difference)}</strong><small>Valor oficial menos detectado</small></article>
          <article className="collections-metric"><span>Movimientos</span><strong>{movements}</strong><small>Registros detectados en el período</small></article>
        </div>
        <div className="collections-breakdown">
          <div><span>Abonos parciales</span><strong>{fmtMoney(stats?.cobrosMes.abonosParcialesDetectados ?? 0)}</strong><small>{stats?.cobrosMes.movimientosParciales ?? 0} movimientos</small></div>
          <div><span>Cierres por desaparición</span><strong>{fmtMoney(stats?.cobrosMes.cierresPorDesaparicionDetectados ?? 0)}</strong><small>{stats?.cobrosMes.movimientosPorDesaparicion ?? 0} movimientos</small></div>
          <div><span>Otros detectados</span><strong>{fmtMoney(stats?.cobrosMes.otrosDetectados ?? 0)}</strong><small>{stats?.cobrosMes.otrosMovimientos ?? 0} movimientos</small></div>
        </div>
        <div className="collections-form-grid">
          <label className="collections-field"><span>Valor oficial del período</span><input type="text" inputMode="decimal" value={officialValue} onChange={(e)=>setOfficialValue(e.target.value)} placeholder="0,00" disabled={saving}/></label>
          <label className="collections-field collections-field--observation"><span>Observación de conciliación</span><textarea value={observation} onChange={(e)=>setObservation(e.target.value)} rows={3} placeholder="Explica diferencias, ajustes, retenciones u observaciones del período." disabled={saving}/></label>
          <div className="collections-form-actions"><button type="button" className="btn primary collections-save" onClick={()=>void saveReconciliation()} disabled={saving||loading||!stats}>{saving ? "Guardando..." : isReconciled ? "Actualizar conciliación" : "Conciliar período"}</button></div>
        </div>
        {reconciliation && <div className="collections-audit"><span>Conciliado por <strong>{reconciliation.reconciledBy}</strong></span><span>Fecha <strong>{formatDateTime(reconciliation.reconciledAt)}</strong></span><span>Snapshot detectado <strong>{fmtMoney(reconciliation.detectedValue)}</strong></span></div>}
        {stats?.cobrosMes.nota && <div className="collections-note">{stats.cobrosMes.nota}</div>}
        {message && <div className={`collections-message collections-message--${messageTone}`}>{message}</div>}
      </section>

      <section className="card collections-history-card">
        <div className="collections-history-header"><div><div className="card-title">Historial de Abonos Detectados</div><p>Movimientos positivos registrados por cambios de saldo.</p></div><div className="collections-history-actions">
          <label className="collections-field collections-field--compact"><span>Desde</span><input type="date" value={fechaDesde} onChange={(e)=>onFechaDesdeChange(e.target.value)}/></label>
          <label className="collections-field collections-field--compact"><span>Hasta</span><input type="date" value={fechaHasta} onChange={(e)=>onFechaHastaChange(e.target.value)}/></label>
          <button type="button" className="btn secondary" onClick={()=>void onExportPdf()}>Exportar PDF</button>
        </div></div>
        <div className="table-wrapper collections-table-wrapper"><table className="data-table collections-table"><thead><tr><th>Fecha Detección</th><th>Cliente</th><th>Documento</th><th className="num">Saldo Anterior</th><th className="num">Pago Aplicado</th><th className="num">Nuevo Saldo</th><th>Observación</th></tr></thead><tbody>
          {filtered.length>0 ? filtered.map((abono)=><tr key={abono.id}><td>{abono.fecha.split("T")[0]}</td><td><strong>{abono.cliente||abono.razon_social||"-"}</strong></td><td><strong>{abono.documento}</strong></td><td className="num">{fmtMoney(abono.total_anterior)}</td><td className="num kpi-positive">{fmtMoney(abono.total_anterior-abono.total_nuevo)}</td><td className="num">{fmtMoney(abono.total_nuevo)}</td><td className="collections-observation-cell">{abono.observacion||"-"}</td></tr>) : <tr><td colSpan={7} className="collections-empty"><strong>No hay abonos detectados en este rango.</strong><span>Importa el Excel para detectar cambios en los saldos.</span></td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
