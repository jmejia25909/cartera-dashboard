import type { EmpresaData } from '../../types/api.types';

interface HttpDocument {
  cliente?: string;
  razon_social?: string;
  vendedor?: string;
  [key: string]: unknown;
}

interface DocumentFilters {
  cliente?: string;
  vendedor?: string;
}

interface RowsPayload<T> {
  rows?: T[];
}

const API_BASE_URL = 'http://localhost:3000/api';

async function readJson<T = unknown>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function extractRows<T>(payload: RowsPayload<T> | T[]): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload.rows) ? payload.rows : [];
}

export async function checkHttpApiAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 2_000);

    const response = await fetch(`${API_BASE_URL}/stats`, {
      method: 'GET',
      signal: controller.signal,
    });

    window.clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export function createHttpApiClient() {
  return {
    documentosListar: async (filtros: DocumentFilters) => {
      const params = new URLSearchParams();

      if (filtros.cliente) {
        params.append('cliente', filtros.cliente);
      }

      if (filtros.vendedor) {
        params.append('vendedor', filtros.vendedor);
      }

      const response = await fetch(
        `${API_BASE_URL}/documentos?${params.toString()}`
      );
      const data = await readJson<RowsPayload<HttpDocument> | HttpDocument[]>(
        response
      );
      return { ok: true, rows: extractRows<HttpDocument>(data) };
    },

    statsObtener: async () => {
      const response = await fetch(`${API_BASE_URL}/stats`);
      return readJson(response);
    },

    dashboardExecutiveStats: async () => {
      const response = await fetch(
        `${API_BASE_URL}/dashboard-executive`,
      );
      return readJson(response);
    },

    filtrosListar: async () => {
      const response = await fetch(`${API_BASE_URL}/documentos`);
      const data = await readJson<RowsPayload<HttpDocument> | HttpDocument[]>(
        response
      );
      const docs = extractRows<HttpDocument>(data);

      const customerCodes = Array.from(
        new Set(
          docs
            .map((document) => document.cliente)
            .filter((value): value is string => Boolean(value))
        )
      );

      const clientes = customerCodes.map((cliente) => {
        const document = docs.find((item) => item.cliente === cliente);

        return {
          cliente,
          razon_social: document?.razon_social || cliente,
        };
      });

      const vendedores = Array.from(
        new Set(
          docs
            .map((document) => document.vendedor)
            .filter((value): value is string => Boolean(value))
        )
      );

      return {
        clientes,
        vendedores,
        tipos: [] as string[],
      };
    },

    topClientes: async (limit = 10) => {
      const response = await fetch(
        `${API_BASE_URL}/top-clientes?limit=${limit}`
      );
      const data = await readJson<RowsPayload<unknown> | unknown[]>(response);
      return extractRows(data);
    },

    empresaObtener: async (): Promise<EmpresaData> => {
      const response = await fetch(`${API_BASE_URL}/empresa`);
      return readJson<EmpresaData>(response);
    },

    gestionesListar: async (cliente: string) => {
      const query = cliente
        ? `?cliente=${encodeURIComponent(cliente)}`
        : '';
      const response = await fetch(`${API_BASE_URL}/gestiones${query}`);
      const data = await readJson<RowsPayload<unknown> | unknown[]>(response);
      return extractRows(data);
    },

    alertasIncumplimiento: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/alertas`);
        const data = await readJson<RowsPayload<unknown> | unknown[]>(response);
        return extractRows(data);
      } catch {
        return [];
      }
    },

    tendenciasHistoricas: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/tendencias`);
        const data = await readJson<RowsPayload<unknown> | unknown[]>(response);
        return extractRows(data);
      } catch {
        return [];
      }
    },

    cuentasAplicarListar: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/cuentas-aplicar`);
        const data = await readJson<RowsPayload<unknown> | unknown[]>(response);
        return extractRows(data);
      } catch {
        return [];
      }
    },

    abonosListar: async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/abonos`);
        const data = await readJson<RowsPayload<unknown> | unknown[]>(response);
        return extractRows(data);
      } catch {
        return [];
      }
    },
  };
}
