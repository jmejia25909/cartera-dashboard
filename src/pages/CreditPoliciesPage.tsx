import { useCallback, useEffect, useMemo, useState } from "react";
import { getElectronApi } from "../app/api";

type CreditPolicyRow = {
  cliente: string;
  tipo_credito: "CONTADO" | "CREDITO";
  dias_credito: number | null;
  credito_configurado: number;
  documentos_pendientes: number;
  alerta_estado: string | null;
};

type FilterMode = "TODOS" | "PENDIENTES" | "CONFIGURADOS";

const PRESETS = [0, 15, 30, 45, 60, 90];

export function CreditPoliciesPage() {
  const api = getElectronApi();
  const [rows, setRows] = useState<CreditPolicyRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("PENDIENTES");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CreditPolicyRow | null>(null);
  const [days, setDays] = useState(30);
  const [recalculate, setRecalculate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!api?.creditPoliciesList) {
      setLoading(false);
      setMessage("El módulo de políticas de crédito solo está disponible en escritorio.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.creditPoliciesList();
      setRows(result.rows);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar las políticas.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch = !term || row.cliente.toLowerCase().includes(term);
      const matchesFilter =
        filter === "TODOS" ||
        (filter === "PENDIENTES" && row.documentos_pendientes > 0) ||
        (filter === "CONFIGURADOS" && row.credito_configurado === 1);

      return matchesSearch && matchesFilter;
    });
  }, [filter, rows, search]);

  const summary = useMemo(
    () => ({
      clients: rows.length,
      pendingClients: rows.filter((row) => row.documentos_pendientes > 0).length,
      pendingDocuments: rows.reduce((sum, row) => sum + row.documentos_pendientes, 0),
      configured: rows.filter((row) => row.credito_configurado === 1).length,
    }),
    [rows],
  );

  function openPolicy(row: CreditPolicyRow) {
    setSelected(row);
    setDays(row.credito_configurado === 1 ? Number(row.dias_credito ?? 0) : 30);
    setRecalculate(row.documentos_pendientes > 0);
    setMessage("");
  }

  async function savePolicy() {
    if (!selected || !api?.creditPolicySave) return;

    if (!Number.isInteger(days) || days < 0 || days > 365) {
      setMessage("Los días de crédito deben ser un entero entre 0 y 365.");
      return;
    }

    const affected = recalculate ? selected.documentos_pendientes : 0;
    const action = days === 0 ? "contado" : `${days} días de crédito`;
    const confirmText = recalculate
      ? `Se configurará ${selected.cliente} como ${action} y se recalcularán ${affected} documentos pendientes.`
      : `Se configurará ${selected.cliente} como ${action} únicamente para futuras importaciones.`;

    if (!window.confirm(confirmText)) return;

    setSaving(true);
    setMessage("");

    try {
      const result = await api.creditPolicySave({
        cliente: selected.cliente,
        tipoCredito: days === 0 ? "CONTADO" : "CREDITO",
        diasCredito: days,
        recalcularPendientes: recalculate,
      });

      if (!result.ok) {
        setMessage(result.message ?? "No se pudo guardar la política.");
        return;
      }

      setMessage(
        recalculate
          ? `Política guardada. ${result.documentosActualizados} documentos actualizados.`
          : "Política guardada para futuras importaciones.",
      );
      setSelected(null);
      await load();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Error guardando la política.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Políticas de crédito</h1>
          <p style={styles.subtitle}>
            Configura los días de crédito y corrige vencimientos importados no válidos.
          </p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={() => void load()}>
          Actualizar
        </button>
      </header>

      <div style={styles.cards}>
        <Metric label="Clientes detectados" value={summary.clients} />
        <Metric label="Clientes pendientes" value={summary.pendingClients} />
        <Metric label="Documentos pendientes" value={summary.pendingDocuments} />
        <Metric label="Clientes configurados" value={summary.configured} />
      </div>

      {message && <div style={styles.message}>{message}</div>}

      <div style={styles.toolbar}>
        <input
          style={styles.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar cliente..."
        />
        <select
          style={styles.select}
          value={filter}
          onChange={(event) => setFilter(event.target.value as FilterMode)}
        >
          <option value="PENDIENTES">Pendientes</option>
          <option value="CONFIGURADOS">Configurados</option>
          <option value="TODOS">Todos</option>
        </select>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Cliente</th>
              <th style={styles.th}>Estado</th>
              <th style={styles.th}>Política</th>
              <th style={styles.th}>Docs. pendientes</th>
              <th style={styles.th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td style={styles.empty} colSpan={5}>Cargando...</td>
              </tr>
            )}
            {!loading && filteredRows.length === 0 && (
              <tr>
                <td style={styles.empty} colSpan={5}>No hay clientes para mostrar.</td>
              </tr>
            )}
            {!loading && filteredRows.map((row) => (
              <tr key={row.cliente}>
                <td style={styles.td}><strong>{row.cliente}</strong></td>
                <td style={styles.td}>
                  <span style={row.documentos_pendientes > 0 ? styles.badgePending : styles.badgeOk}>
                    {row.documentos_pendientes > 0 ? "Pendiente" : "Configurado"}
                  </span>
                </td>
                <td style={styles.td}>
                  {row.credito_configurado === 1
                    ? row.tipo_credito === "CONTADO"
                      ? "Contado"
                      : `${row.dias_credito ?? 0} días`
                    : "Sin configurar"}
                </td>
                <td style={styles.td}>{row.documentos_pendientes}</td>
                <td style={styles.td}>
                  <button type="button" style={styles.primaryButton} onClick={() => openPolicy(row)}>
                    Configurar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={styles.overlay} role="presentation" onMouseDown={() => !saving && setSelected(null)}>
          <div style={styles.modal} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2 style={styles.modalTitle}>Configurar política</h2>
            <p style={styles.clientName}>{selected.cliente}</p>

            <label style={styles.label}>Días de crédito</label>
            <div style={styles.presets}>
              {PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  style={days === preset ? styles.presetActive : styles.preset}
                  onClick={() => setDays(preset)}
                >
                  {preset === 0 ? "Contado" : `${preset} días`}
                </button>
              ))}
            </div>

            <input
              type="number"
              min={0}
              max={365}
              step={1}
              style={styles.numberInput}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
            />

            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={recalculate}
                disabled={selected.documentos_pendientes === 0}
                onChange={(event) => setRecalculate(event.target.checked)}
              />
              <span>
                Recalcular los {selected.documentos_pendientes} documentos pendientes del cliente.
              </span>
            </label>

            <p style={styles.help}>
              Desmarcado: la política se aplicará únicamente a futuras importaciones.
              Marcado: fecha de vencimiento = fecha de emisión + días configurados.
            </p>

            <div style={styles.actions}>
              <button type="button" style={styles.secondaryButton} disabled={saving} onClick={() => setSelected(null)}>
                Cancelar
              </button>
              <button type="button" style={styles.primaryButton} disabled={saving} onClick={() => void savePolicy()}>
                {saving ? "Guardando..." : "Guardar política"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value.toLocaleString("es-EC")}</strong>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 24, display: "grid", gap: 20 },
  header: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" },
  title: { margin: 0, fontSize: 28 },
  subtitle: { margin: "6px 0 0", opacity: 0.7 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  metric: { background: "var(--card-bg, #fff)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 12, padding: 16 },
  metricLabel: { display: "block", fontSize: 13, opacity: 0.7, marginBottom: 8 },
  metricValue: { fontSize: 24 },
  toolbar: { display: "flex", gap: 12, flexWrap: "wrap" },
  search: { flex: "1 1 320px", minHeight: 42, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 12px" },
  select: { minHeight: 42, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 12px" },
  tableWrap: { overflowX: "auto", background: "var(--card-bg, #fff)", border: "1px solid var(--border-color, #e5e7eb)", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: 12, borderBottom: "1px solid #e5e7eb", fontSize: 13 },
  td: { padding: 12, borderBottom: "1px solid #f1f5f9" },
  empty: { padding: 36, textAlign: "center", opacity: 0.65 },
  badgePending: { display: "inline-block", padding: "4px 9px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 700 },
  badgeOk: { display: "inline-block", padding: "4px 9px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 700 },
  primaryButton: { minHeight: 38, border: 0, borderRadius: 8, padding: "0 14px", cursor: "pointer", background: "#2563eb", color: "#fff", fontWeight: 700 },
  secondaryButton: { minHeight: 38, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 14px", cursor: "pointer", background: "var(--card-bg, #fff)", color: "inherit", fontWeight: 600 },
  message: { borderRadius: 8, padding: 12, background: "#eff6ff", border: "1px solid #bfdbfe" },
  overlay: { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, .55)", display: "grid", placeItems: "center", padding: 20 },
  modal: { width: "min(620px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--card-bg, #fff)", color: "inherit", borderRadius: 16, padding: 24, boxShadow: "0 24px 80px rgba(0,0,0,.25)" },
  modalTitle: { margin: 0 },
  clientName: { fontWeight: 700, margin: "8px 0 22px" },
  label: { display: "block", fontWeight: 700, marginBottom: 10 },
  presets: { display: "flex", flexWrap: "wrap", gap: 8 },
  preset: { border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", cursor: "pointer", background: "transparent", color: "inherit" },
  presetActive: { border: "1px solid #2563eb", borderRadius: 8, padding: "9px 12px", cursor: "pointer", background: "#2563eb", color: "#fff" },
  numberInput: { width: "100%", boxSizing: "border-box", minHeight: 42, marginTop: 12, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 12px" },
  checkboxRow: { display: "flex", gap: 10, alignItems: "flex-start", marginTop: 20, fontWeight: 600 },
  help: { fontSize: 13, opacity: 0.72, lineHeight: 1.5 },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 },
};
