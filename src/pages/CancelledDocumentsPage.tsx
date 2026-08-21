import { useEffect, useMemo, useState } from "react";
import { getElectronApi } from "../app/api";
import { createPdfContext, generateCancelledDocumentsReport } from "../pdf";

type PreviewRow = {
  rowNumber: number;
  cancellationDate: string;
  documentType: string;
  documentNumber: string;
  normalizedDocumentNumber: string;
  sourceStatus: string;
  authorizationNumber: string;
  matchStatus: "ENCONTRADO" | "NO_ENCONTRADO" | "YA_ANULADO" | "DUPLICADO_HISTORICO";
  customer: string | null;
  activePayments: number;
};

type PreviewResult = {
  ok: boolean;
  filePath: string;
  sheetName: string;
  companyName: string;
  reportTitle: string;
  totalRows: number;
  historicalDuplicates: number;
  foundDocuments: number;
  alreadyCancelledDocuments: number;
  unmatchedDocuments: number;
  paymentsToReverse: number;
  rows: PreviewRow[];
  message?: string;
};

type CancelledDocumentLogRow = {
  id: number;
  documento: string;
  cliente: string | null;
  fecha_anulacion: string | null;
  motivo: string | null;
  archivo_origen: string | null;
  detectado_en: string;
  resultado: string;
  tipo_documento: string | null;
  estado_origen: string | null;
  numero_autorizacion: string | null;
};

export function CancelledDocumentsPage() {
  const api = getElectronApi();
  const [rows, setRows] = useState<CancelledDocumentLogRow[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadHistory() {
    if (!api?.cancelledDocumentsList) return;
    const result = await api.cancelledDocumentsList();
    setRows(result.rows);
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  const previewRows = useMemo(() => preview?.rows ?? [], [preview]);

  async function exportPdf() {
    if (rows.length === 0) {
      setMessage("No hay documentos anulados para exportar.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const company = api?.empresaObtener
        ? await api.empresaObtener()
        : { nombre: "Mi Empresa" };

      const reversalSummary = api?.cancelledDocumentsReversalSummary
        ? await api.cancelledDocumentsReversalSummary()
        : { reversedPayments: 0, reversedAmount: 0 };

      await generateCancelledDocumentsReport({
        rows,
        context: createPdfContext(company ?? { nombre: "Mi Empresa" }),
        reversedPayments: Number(reversalSummary?.reversedPayments || 0),
        reversedAmount: Number(reversalSummary?.reversedAmount || 0),
      });

      setMessage("PDF de documentos anulados generado correctamente.");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo generar el PDF de documentos anulados.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function selectFile() {
    if (!api?.previewCancelledDocuments) {
      setMessage("Disponible únicamente en escritorio.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await api.previewCancelledDocuments();

      if (!result.ok) {
        setPreview(null);
        setMessage(result.message ?? "No se pudo analizar el archivo.");
        return;
      }

      setPreview(result);
      setMessage("Vista previa generada. Revisa el resumen antes de confirmar.");
    } catch (error: unknown) {
      setPreview(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Error analizando Documentos Anulados.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!preview || !api?.confirmCancelledDocumentsImport) return;

    const confirmed = window.confirm(
      `Se anularán ${preview.foundDocuments} documentos y se reversarán ` +
      `${preview.paymentsToReverse} abonos activos. ¿Deseas continuar?`,
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");

    try {
      const result = await api.confirmCancelledDocumentsImport(preview.filePath);

      if (!result.ok) {
        setMessage(result.message ?? "No se pudo importar el archivo.");
        return;
      }

      setMessage(
        `Importación completada: ${result.cancelledDocuments} anulados, ` +
        `${result.alreadyCancelledDocuments} ya anulados, ` +
        `${result.reversedPayments} abonos reversados y ` +
        `${result.unmatchedDocuments} no encontrados.`,
      );

      setPreview(null);
      await loadHistory();
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Error importando Documentos Anulados.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ padding: 24, display: "grid", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Documentos anulados</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.7 }}>
            Analiza primero el archivo y confirma después la anulación.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={loading || rows.length === 0}
            className="btn secondary"
            style={{ minHeight: 42, padding: "0 16px" }}
          >
            📄 Exportar PDF
          </button>

          <button
            type="button"
            onClick={() => void selectFile()}
            disabled={loading}
            style={{
              minHeight: 42,
              border: 0,
              borderRadius: 8,
              padding: "0 16px",
              background: "#b91c1c",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {loading ? "Procesando..." : "Seleccionar Documentos Anulados"}
          </button>
        </div>
      </header>

      {message && (
        <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 8, padding: 12 }}>
          {message}
        </div>
      )}

      {preview && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(140px, 1fr))", gap: 12 }}>
            {[
              ["Registros", preview.totalRows],
              ["Nuevos", preview.foundDocuments],
              ["Duplicados históricos", preview.historicalDuplicates],
              ["Ya anulados", preview.alreadyCancelledDocuments],
              ["No encontrados", preview.unmatchedDocuments],
              ["Abonos a reversar", preview.paymentsToReverse],
            ].map(([label, value]) => (
              <div key={String(label)} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, background: "#fff" }}>
                <div style={{ fontSize: 13, opacity: 0.65 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: 12, borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa" }}>
            <strong>{preview.companyName || "Empresa no identificada"}</strong>
            {" · "}
            {preview.reportTitle || "Documentos Anulados"}
            {" · Hoja: "}
            {preview.sheetName}
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", maxHeight: 420 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Fila", "Fecha", "Tipo", "Documento", "Estado origen", "Coincidencia", "Cliente", "Abonos activos"].map((label) => (
                    <th key={label} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, background: "#fff" }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={`${row.rowNumber}-${row.documentNumber}`}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{row.rowNumber}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{row.cancellationDate || "-"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{row.documentType || "-"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}><strong>{row.documentNumber}</strong></td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{row.sourceStatus || "-"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{row.matchStatus}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{row.customer || "-"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{row.activePayments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={() => setPreview(null)} disabled={loading}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirmImport()}
              disabled={loading}
              style={{
                minHeight: 40,
                border: 0,
                borderRadius: 8,
                padding: "0 16px",
                background: "#dc2626",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              Confirmar anulación
            </button>
          </div>
        </>
      )}

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Documento", "Tipo", "Cliente", "Fecha anulación", "Estado origen", "Resultado", "Detectado"].map((label) => (
                <th key={label} style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e5e7eb" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 36, textAlign: "center" }}>
                  No se han importado documentos anulados.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}><strong>{row.documento}</strong></td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.tipo_documento || "-"}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.cliente || "-"}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.fecha_anulacion || "-"}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.estado_origen || "-"}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.resultado}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.detectado_en}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

