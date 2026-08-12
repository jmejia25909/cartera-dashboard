import { useCallback, useEffect, useMemo, useState } from "react";
import "./import-center.css";

type ImportType =
  | "CARTERA"
  | "ANULADOS"
  | "NOTAS_CREDITO"
  | "COBROS_MOVIMIENTOS";

type ImportStatus =
  | "PROCESANDO"
  | "COMPLETADA"
  | "COMPLETADA_ADVERTENCIAS"
  | "ERROR"
  | "REVERTIDA";

interface ImportHistoryRow {
  id: number;
  tipo: ImportType;
  archivo_nombre: string;
  periodo_desde?: string | null;
  periodo_hasta?: string | null;
  registros_leidos: number;
  registros_importados: number;
  registros_ignorados: number;
  registros_duplicados: number;
  estado: ImportStatus;
  importado_en: string;
  revertido_en?: string | null;
  observacion?: string | null;
}

interface ImportHistoryResult {
  ok: boolean;
  rows?: ImportHistoryRow[];
  message?: string;
}

interface ImportReversalResult {
  ok: boolean;
  code?: string;
  message?: string;
}

type ImportCenterApi = typeof window.carteraApi & {
  importHistoryList?: (args?: {
    tipo?: ImportType;
    limit?: number;
  }) => Promise<ImportHistoryResult>;
  importHistoryGet?: (id: number) => Promise<unknown>;
  importHistoryRevert?: (args: {
    id: number;
    observacion?: string;
  }) => Promise<ImportReversalResult>;
  previewCreditNotes?: () => Promise<{
    ok: boolean;
    filePath?: string;
    totalRows?: number;
    uniqueCreditNotes?: number;
    duplicateRows?: number;
    matchedDocuments?: number;
    unmatchedDocuments?: number;
    missingRelatedDocument?: number;
    totalAmount?: number;
    message?: string;
  }>;
  confirmCreditNotesImport?: (filePath: string) => Promise<{
    ok: boolean;
    duplicateImport?: boolean;
    appliedCreditNotes?: number;
    pendingCreditNotes?: number;
    message?: string;
  }>;
  previewCollectionMovements?: () => Promise<{
    ok: boolean;
    filePath?: string;
    totalRows?: number;
    sourceCollections?: number;
    ignoredPayments?: number;
    uniqueMovements?: number;
    duplicateRows?: number;
    matchedDocuments?: number;
    unmatchedDocuments?: number;
    missingDocument?: number;
    totalValue?: number;
    classes?: Record<string, { count: number; value: number }>;
    message?: string;
  }>;
  confirmCollectionMovementsImport?: (filePath: string) => Promise<{
    ok: boolean;
    duplicateImport?: boolean;
    importedMovements?: number;
    existingMovements?: number;
    reconciledMovements?: number;
    pendingMovements?: number;
    message?: string;
  }>;
  reconciliationControlGet?: () => Promise<{ ok: boolean; state?: { cutoff_date: string; operation_start_date: string; mode: string; generation: number; next_snapshot_date?: string | null } }>;
  historicalBootstrapFinish?: () => Promise<{ ok: boolean; message?: string }>;
  historicalBootstrapReset?: () => Promise<{ ok: boolean; message?: string }>;
  resetReconciliationProjection?: () => Promise<{
    ok: boolean;
    state?: {
      cutoff_date: string;
      operation_start_date: string;
      mode: string;
      generation: number;
    };
    message?: string;
  }>;
};

interface ImportCenterPanelProps {
  hasWritePermissions: boolean;
  onImportPortfolio: () => void | Promise<void>;
  onOpenCancelledImport: () => void;
  onExportBackup: () => void | Promise<void>;
  onClearDatabase: () => void;
}

const TYPE_LABELS: Record<ImportType, string> = {
  CARTERA: "Cartera Contífico",
  ANULADOS: "Documentos anulados",
  NOTAS_CREDITO: "Notas de crédito",
  COBROS_MOVIMIENTOS: "Cobros y movimientos relacionados",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T");

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

export function ImportCenterPanel({
  hasWritePermissions,
  onImportPortfolio,
  onOpenCancelledImport,
  onExportBackup,
  onClearDatabase,
}: ImportCenterPanelProps) {
  const [history, setHistory] = useState<ImportHistoryRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyNotice, setHistoryNotice] = useState("");
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [resettingProjection, setResettingProjection] = useState(false);
  const [historicalMode, setHistoricalMode] = useState(false);
  const [generation, setGeneration] = useState<number | null>(null);

  const api = window.carteraApi as ImportCenterApi;

  const refreshReconciliationControl = useCallback(async (): Promise<void> => {
    if (!api?.reconciliationControlGet) return;
    const result = await api.reconciliationControlGet();
    if (result?.ok && result.state) {
      setHistoricalMode(result.state.mode === "HISTORICAL_LOAD");
      setGeneration(result.state.generation);
    }
  }, [api]);

  useEffect(() => { void refreshReconciliationControl(); }, [refreshReconciliationControl]);

  const finishHistoricalBootstrap = async (): Promise<void> => {
    if (!api?.historicalBootstrapFinish) return;
    if (!window.confirm("¿Finalizar la carga histórica y pasar definitivamente a modo PRODUCTION?")) return;
    const result = await api.historicalBootstrapFinish();
    window.alert(result?.message || (result?.ok ? "Modo PRODUCTION activado." : "No fue posible finalizar."));
    await refreshReconciliationControl();
  };

  const resetHistoricalBootstrap = async (): Promise<void> => {
    if (!api?.historicalBootstrapReset) return;
    if (!window.confirm("RESET HISTÓRICO OFICIAL\n\nElimina snapshots, eventos, importaciones y ledgers de prueba. Preserva esquema y configuración.\n\n¿Continuar?")) return;
    const result = await api.historicalBootstrapReset();
    window.alert(result?.message || (result?.ok ? "Bootstrap histórico reiniciado." : "No fue posible reiniciar."));
    await refreshReconciliationControl();
    if (historyOpen) await loadHistory();
  };

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!api?.importHistoryList) {
      setHistory([]);
      setHistoryError(
        "El historial de importaciones solo está disponible en la aplicación de escritorio.",
      );
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const result = await api.importHistoryList({
        limit: 100,
      });

      if (!result?.ok) {
        throw new Error(
          result?.message ||
            "No fue posible consultar el historial de importaciones.",
        );
      }

      setHistory(result.rows ?? []);
    } catch (error: unknown) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Error consultando el historial de importaciones.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [api]);

  const openHistory = async (): Promise<void> => {
    setHistoryOpen(true);
    setHistoryNotice("");
    await loadHistory();
  };

  const latestByType = useMemo(() => {
    const result = new Map<ImportType, ImportHistoryRow>();

    for (const row of history) {
      if (!result.has(row.tipo) && row.estado !== "REVERTIDA") {
        result.set(row.tipo, row);
      }
    }

    return result;
  }, [history]);

  useEffect(() => {
    if (historyOpen) {
      void loadHistory();
    }
  }, [historyOpen, loadHistory]);

  const revertImport = async (
    row: ImportHistoryRow,
  ): Promise<void> => {
    if (!api?.importHistoryRevert) {
      setHistoryError(
        "La reversión solo está disponible en la aplicación de escritorio.",
      );
      return;
    }

    if (row.tipo !== "CARTERA") {
      setHistoryError(
        "La reversión transaccional todavía no está habilitada para este tipo de importación.",
      );
      return;
    }

    const accepted = window.confirm(
      `¿Revertir la importación de cartera "${row.archivo_nombre}"?\n\n` +
        "Se restaurará la cartera, los movimientos inferidos y las alertas al estado anterior a esa importación.",
    );

    if (!accepted) return;

    setRevertingId(row.id);
    setHistoryError("");
    setHistoryNotice("");

    try {
      const result = await api.importHistoryRevert({
        id: row.id,
        observacion: "Reversión solicitada desde Gestión de Datos",
      });

      if (!result?.ok) {
        throw new Error(
          result?.message || "No fue posible revertir la importación.",
        );
      }

      setHistoryNotice(
        result.message ||
          "Importación revertida correctamente. Recarga los datos de la aplicación para visualizar el estado restaurado.",
      );

      await loadHistory();
    } catch (error: unknown) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Error revirtiendo la importación.",
      );
    } finally {
      setRevertingId(null);
    }
  };

  const importCreditNotes = async (): Promise<void> => {
    if (!api?.previewCreditNotes || !api?.confirmCreditNotesImport) {
      window.alert(
        "El importador de notas de crédito solo está disponible en la aplicación de escritorio.",
      );
      return;
    }

    try {
      const preview = await api.previewCreditNotes();
      if (!preview?.ok) {
        if (preview?.message && preview.message !== "Selección cancelada") {
          window.alert(preview.message);
        }
        return;
      }

      const accepted = window.confirm(
        "Vista previa de Notas de Crédito\n\n" +
          `Registros: ${preview.totalRows ?? 0}\n` +
          `Notas únicas: ${preview.uniqueCreditNotes ?? 0}\n` +
          `Duplicados: ${preview.duplicateRows ?? 0}\n` +
          `Facturas encontradas: ${preview.matchedDocuments ?? 0}\n` +
          `Facturas no encontradas: ${preview.unmatchedDocuments ?? 0}\n` +
          `Sin documento relacionado: ${preview.missingRelatedDocument ?? 0}\n` +
          `Valor total NC: $${Number(preview.totalAmount ?? 0).toFixed(2)}\n\n` +
          "¿Confirmar importación?",
      );

      if (!accepted || !preview.filePath) return;

      const result = await api.confirmCreditNotesImport(preview.filePath);

      window.alert(
        result?.message ||
          (result?.ok
            ? "Notas de crédito importadas correctamente."
            : "No fue posible importar las notas de crédito."),
      );

      if (result?.ok && historyOpen) {
        await loadHistory();
      }
    } catch (error: unknown) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Error importando notas de crédito.",
      );
    }
  };

  const importCollectionMovements = async (): Promise<void> => {
    if (
      !api?.previewCollectionMovements ||
      !api?.confirmCollectionMovementsImport
    ) {
      window.alert(
        "El importador de Cobros/Pagos solo está disponible en la aplicación de escritorio.",
      );
      return;
    }

    try {
      const preview = await api.previewCollectionMovements();

      if (!preview?.ok) {
        if (preview?.message && preview.message !== "Selección cancelada") {
          window.alert(preview.message);
        }
        return;
      }

      const classes = preview.classes ?? {};
      const classLine = (key: string, label: string): string => {
        const row = classes[key];
        return row
          ? `${label}: ${row.count} · $${Number(row.value ?? 0).toFixed(2)}`
          : `${label}: 0 · $0.00`;
      };

      const accepted = window.confirm(
        "Vista previa de Cobros y Movimientos Relacionados\n\n" +
          `Filas tipo Cobro: ${preview.sourceCollections ?? 0}\n` +
          `Filas tipo Pago excluidas: ${preview.ignoredPayments ?? 0}\n` +
          `Movimientos únicos: ${preview.uniqueMovements ?? 0}\n` +
          `Duplicados en archivo: ${preview.duplicateRows ?? 0}\n` +
          `Documentos vigentes encontrados: ${preview.matchedDocuments ?? 0}\n` +
          `Documentos no encontrados: ${preview.unmatchedDocuments ?? 0}\n` +
          `Sin comprobante relacionado: ${preview.missingDocument ?? 0}\n` +
          `Valor total de movimientos: $${Number(preview.totalValue ?? 0).toFixed(2)}\n\n` +
          `${classLine("COBRO", "Cobros")}\n` +
          `${classLine("CRUCE", "Cruces")}\n` +
          `${classLine("ANTICIPO", "Anticipos")}\n` +
          `${classLine("RETENCION", "Retenciones")}\n` +
          `${classLine("OTRO", "Otros")}\n\n` +
          "Importante: este reporte confirma movimientos históricos y su fecha real. " +
          "No vuelve a descontarlos del saldo del corte de cartera vigente.\n\n" +
          "¿Confirmar importación?",
      );

      if (!accepted || !preview.filePath) return;

      const result = await api.confirmCollectionMovementsImport(
        preview.filePath,
      );

      window.alert(
        result?.message ||
          (result?.ok
            ? "Cobros/Pagos importados correctamente."
            : "No fue posible importar Cobros/Pagos."),
      );

      if (result?.ok && historyOpen) {
        await loadHistory();
      }
    } catch (error: unknown) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Error importando Cobros/Pagos.",
      );
    }
  };

  const resetProjection = async (): Promise<void> => {
    if (!api?.resetReconciliationProjection) {
      window.alert(
        "El reinicio controlado solo está disponible en la aplicación de escritorio.",
      );
      return;
    }

    const confirmed = window.confirm(
      "REINICIO CONTROLADO DE PROYECCIÓN\n\n" +
        "Esto eliminará únicamente la proyección actual de documentos y alertas " +
        "reconstruibles. NO elimina importaciones, snapshots, eventos, notas de " +
        "crédito, cobros ni anulados.\n\n" +
        "La próxima importación de Cartera será tratada como BASELINE de una " +
        "nueva generación.\n\n" +
        "¿Deseas continuar?",
    );

    if (!confirmed) return;

    setResettingProjection(true);

    try {
      const result = await api.resetReconciliationProjection();
      window.alert(
        result?.message ||
          (result?.ok
            ? "Proyección reiniciada."
            : "No fue posible reiniciar la proyección."),
      );

      if (result?.ok && historyOpen) {
        await loadHistory();
      }
    } catch (error: unknown) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Error reiniciando la proyección.",
      );
    } finally {
      setResettingProjection(false);
    }
  };

  const importItems = [
    {
      step: 1,
      type: "CARTERA" as const,
      icon: "📥",
      title: "Cartera Contífico",
      description:
        "Actualiza saldos y detecta reducciones o documentos que desaparecen entre cortes.",
      guide: {
        route: "Control de Cartera / Cuentas por Cobrar",
        badges: ["GENERAL", "EXCEL DETALLADO", ".XLS / .XLSX"],
        tooltip:
          "En Contífico exporta toda la cartera activa: modo GENERAL y Excel Detallado. No uses solo cartera vencida.",
      },
      actionLabel: "Importar cartera",
      disabled: !hasWritePermissions,
      onClick: onImportPortfolio,
      state: "available",
    },
    {
      step: 2,
      type: "ANULADOS" as const,
      icon: "🚫",
      title: "Documentos anulados",
      description:
        "Valida qué documentos dejaron de estar vigentes por una anulación.",
      guide: {
        route: "Documentos Anulados",
        badges: ["TODOS", "EXCEL NORMAL", ".XLS / .XLSX"],
        tooltip:
          "En Contífico usa filtro TODOS y exporta como Excel Normal.",
      },
      actionLabel: "Importar anulados",
      disabled: !hasWritePermissions,
      onClick: onOpenCancelledImport,
      state: "available",
    },
    {
      step: 3,
      type: "NOTAS_CREDITO" as const,
      icon: "🧾",
      title: "Notas de crédito",
      description:
        "Concilia cada nota de crédito con su factura mediante el documento relacionado.",
      guide: {
        route: "Clientes → Notas de Crédito",
        badges: ["TODOS", "EXCEL NORMAL", ".XLS / .XLSX"],
        tooltip:
          "En Contífico entra a Clientes → Notas de Crédito, usa filtro TODOS y exporta como Excel Normal.",
      },
      actionLabel: "Importar notas de crédito",
      disabled: !hasWritePermissions,
      onClick: importCreditNotes,
      state: "available",
    },
    {
      step: 4,
      type: "COBROS_MOVIMIENTOS" as const,
      icon: "💰",
      title: "Cobros y movimientos relacionados",
      description:
        "Confirma cobros, cruces, anticipos, retenciones y la fecha real de aplicación.",
      guide: {
        route: "Cobros / Pagos",
        badges: ["TODOS", "EXCEL DETALLADO", ".XLS / .XLSX"],
        tooltip:
          "En Contífico usa filtro TODOS y exporta como Excel Detallado.",
      },
      actionLabel: "Importar cobros/pagos",
      disabled: !hasWritePermissions,
      onClick: importCollectionMovements,
      state: "available",
    },
  ];

  return (
    <>
      <div className="config-card import-center-card">
        <div className="config-header import-center-header">
          <div className="config-icon-box">🗂️</div>
          <div className="config-title">
            <h3>Gestión de Datos</h3>
            <p>Centro único de importaciones, historial y mantenimiento</p>
          </div>
        </div>

        <div className="import-center-section-title">
          <span>IMPORTACIONES</span>
          <small>Orden recomendado de carga</small>
        </div>

        <div className="import-center-operator-note">
          <span className="import-center-operator-note-icon" aria-hidden="true">ℹ️</span>
          <span>
            <strong>Guía del operador:</strong> el sistema acepta <b>.XLS</b> y <b>.XLSX</b>.
            El nombre del archivo puede cambiar; antes de importar se valida que los
            encabezados correspondan al reporte seleccionado.
          </span>
        </div>

        <div className="historical-bootstrap-panel">
          <div>
            <strong>Bootstrap histórico</strong>
            <small>Generación {generation ?? "-"} · {historicalMode ? "HISTORICAL_LOAD" : "PRODUCTION / TEST"} · cutoff 2024-01-01</small>
          </div>
          <div className="historical-bootstrap-controls">
            {historicalMode && <button type="button" className="btn secondary" onClick={() => void finishHistoricalBootstrap()} disabled={!hasWritePermissions}>Finalizar histórico → Producción</button>}
            <button type="button" className="btn secondary" onClick={() => void resetHistoricalBootstrap()} disabled={!hasWritePermissions}>Reset histórico oficial</button>
          </div>
          <p><strong>Cartera Contífico:</strong> foto de deuda pendiente viva; usa automáticamente la fecha real de ingesta y no requiere corte histórico manual. <strong>Cobros, NC y Anulados:</strong> fuentes transaccionales históricas; pueden cargarse por bloques semestrales desde 01/01/2024 y se reproducen por su fecha efectiva.</p>
        </div>

        <div className="import-center-flow">
          {importItems.map((item) => {
            const lastImport = latestByType.get(item.type);

            return (
              <button
                key={item.type}
                type="button"
                className={`import-center-item import-center-item--${item.state}`}
                disabled={item.disabled}
                onClick={() => void item.onClick()}
              >
                <span className="import-center-step">{item.step}</span>
                <span className="import-center-item-icon">{item.icon}</span>

                <span className="import-center-copy">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                  <span
                    className="import-center-guide"
                    title={item.guide.tooltip}
                    aria-label={`Guía de exportación: ${item.guide.tooltip}`}
                  >
                    <span className="import-center-guide-route">
                      <span aria-hidden="true">ℹ️</span>
                      {item.guide.route}
                    </span>
                    <span className="import-center-guide-badges">
                      {item.guide.badges.map((badge) => (
                        <b key={badge}>{badge}</b>
                      ))}
                    </span>
                  </span>
                  {lastImport && (
                    <em>
                      Última importación: {formatDate(lastImport.importado_en)}
                    </em>
                  )}
                </span>

                <span className="import-center-action">
                  {item.actionLabel}
                  <span aria-hidden="true">→</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="import-center-separator" />

        <div className="import-center-section-title">
          <span>HISTORIAL</span>
          <small>Auditoría y reversión segura</small>
        </div>

        <button
          type="button"
          className="config-btn import-center-history-button"
          onClick={() => void openHistory()}
        >
          <span>
            <span className="config-btn-icon">🕘</span>
            Historial de importaciones
          </span>
          <span className="config-btn-arrow">→</span>
        </button>

        <div className="import-center-separator" />

        <div className="import-center-section-title">
          <span>MANTENIMIENTO</span>
          <small>Respaldo y operaciones administrativas</small>
        </div>

        <div className="config-actions import-center-maintenance">
          <button
            type="button"
            className="config-btn"
            onClick={() => void onExportBackup()}
          >
            <span>
              <span className="config-btn-icon">📤</span>
              Exportar respaldo completo
            </span>
            <span className="config-btn-arrow">→</span>
          </button>

          <button
            type="button"
            className="config-btn import-center-reset"
            onClick={() => void resetProjection()}
            disabled={!hasWritePermissions || resettingProjection}
            title="Preserva raw ledgers e historial; inicia una nueva generación de snapshots"
          >
            <span>
              <span className="config-btn-icon">♻️</span>
              {resettingProjection
                ? "Reiniciando proyección..."
                : "Reiniciar proyección de pruebas"}
            </span>
            <span className="config-btn-arrow">→</span>
          </button>

          <button
            type="button"
            className="config-btn import-center-danger"
            onClick={onClearDatabase}
            disabled={!hasWritePermissions}
          >
            <span>
              <span className="config-btn-icon">🗑️</span>
              Limpiar base de datos
            </span>
            <span className="config-btn-arrow">→</span>
          </button>
        </div>
      </div>

      {historyOpen && (
        <div
          className="modal-overlay"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="modal import-history-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header import-history-modal-header">
              <div>
                <strong>Historial de importaciones</strong>
                <small>
                  Registro central de las fuentes cargadas en el sistema
                </small>
              </div>

              <button
                type="button"
                className="import-history-close"
                onClick={() => setHistoryOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div className="modal-body import-history-body">
              <div className="import-history-toolbar">
                <span>{history.length} importaciones registradas</span>

                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => void loadHistory()}
                  disabled={historyLoading}
                >
                  {historyLoading ? "Actualizando..." : "Actualizar"}
                </button>
              </div>

              {historyNotice && (
                <div className="import-history-message import-history-message--success">
                  {historyNotice}
                </div>
              )}

              {historyError && (
                <div className="import-history-message import-history-message--error">
                  {historyError}
                </div>
              )}

              {!historyLoading &&
                !historyError &&
                history.length === 0 && (
                  <div className="import-history-empty">
                    <strong>Aún no existen importaciones registradas.</strong>
                    <span>
                      Las importaciones nuevas quedarán registradas aquí para
                      auditoría y reversión segura.
                    </span>
                  </div>
                )}

              {history.length > 0 && (
                <div className="import-history-table-wrapper">
                  <table className="data-table import-history-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Archivo</th>
                        <th className="num">Leídos</th>
                        <th className="num">Importados</th>
                        <th className="num">Duplicados</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id}>
                          <td>{formatDate(row.importado_en)}</td>
                          <td>
                            <strong>{TYPE_LABELS[row.tipo]}</strong>
                          </td>
                          <td title={row.archivo_nombre}>
                            {row.archivo_nombre}
                          </td>
                          <td className="num">{row.registros_leidos}</td>
                          <td className="num">{row.registros_importados}</td>
                          <td className="num">{row.registros_duplicados}</td>
                          <td>
                            <span
                              className={`import-history-status import-history-status--${row.estado.toLowerCase()}`}
                            >
                              {row.estado.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>
                            {row.tipo === "CARTERA" &&
                            row.estado !== "REVERTIDA" &&
                            row.estado !== "ERROR" ? (
                              <button
                                type="button"
                                className="btn secondary import-history-revert"
                                disabled={revertingId === row.id}
                                onClick={() => void revertImport(row)}
                              >
                                {revertingId === row.id
                                  ? "Revirtiendo..."
                                  : "Revertir"}
                              </button>
                            ) : (
                              <span className="import-history-no-action">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="import-history-footnote">
                Por seguridad, solo puede revertirse la última importación
                activa de cartera. Las importaciones posteriores deben
                revertirse primero.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
