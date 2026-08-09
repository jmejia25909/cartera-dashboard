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

  const api = window.carteraApi as ImportCenterApi;

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

  const importItems = [
    {
      step: 1,
      type: "CARTERA" as const,
      icon: "📥",
      title: "Cartera Contífico",
      description:
        "Actualiza saldos y detecta reducciones o documentos que desaparecen entre cortes.",
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
        "Explicará reducciones y cierres de saldo originados por notas de crédito.",
      actionLabel: "Próximo importador",
      disabled: true,
      onClick: (): void => undefined,
      state: "planned",
    },
    {
      step: 4,
      type: "COBROS_MOVIMIENTOS" as const,
      icon: "💰",
      title: "Cobros y movimientos relacionados",
      description:
        "Confirmará cobros, cruces, anticipos, retenciones y la fecha real de aplicación.",
      actionLabel: "Próximo importador",
      disabled: true,
      onClick: (): void => undefined,
      state: "planned",
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
