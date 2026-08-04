import { useEffect, useState } from "react";
import { getElectronApi } from "../app/api";

type CancelledDocumentLogRow = {
  id: number;
  documento: string;
  cliente: string | null;
  fecha_anulacion: string | null;
  motivo: string | null;
  archivo_origen: string | null;
  detectado_en: string;
  resultado: string;
};

export function CancelledDocumentsPage() {
  const api = getElectronApi();
  const [rows, setRows] = useState<CancelledDocumentLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    if (!api?.cancelledDocumentsList) return;
    const result = await api.cancelledDocumentsList();
    setRows(result.rows);
  }

  useEffect(() => {
    void load();
  }, []);

  async function importFile() {
    if (!api?.importCancelledDocuments) {
      setMessage("Disponible únicamente en escritorio.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await api.importCancelledDocuments();

      if (!result.ok) {
        setMessage(result.message ?? "No se pudo importar el archivo.");
        return;
      }

      setMessage(
        `Importación completada: ${result.cancelledDocuments} documentos anulados, ` +
        `${result.reversedPayments} abonos reversados y ` +
        `${result.unmatchedDocuments} documentos no encontrados.`,
      );

      await load();
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Error importando documentos anulados.",
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
            Anula documentos y revierte sus abonos sin eliminarlos del historial.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void importFile()}
          disabled={loading}
          style={{
            minHeight: 42, border: 0, borderRadius: 8, padding: "0 16px",
            background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer",
          }}
        >
          {loading ? "Importando..." : "Importar Documentos Anulados"}
        </button>
      </header>

      {message && (
        <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 8, padding: 12 }}>
          {message}
        </div>
      )}

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "var(--card-bg, #fff)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Documento", "Cliente", "Fecha anulación", "Resultado", "Detectado", "Motivo"].map((label) => (
                <th key={label} style={{ textAlign: "left", padding: 12, borderBottom: "1px solid #e5e7eb" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 36, textAlign: "center" }}>
                  No se han importado documentos anulados.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}><strong>{row.documento}</strong></td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.cliente || "-"}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.fecha_anulacion || "-"}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.resultado}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.detectado_en}</td>
                  <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>{row.motivo || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
