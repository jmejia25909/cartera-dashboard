import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createHttpApiClient,
  getElectronApi,
} from "../../app/api";
import {
  DashboardHeader,
  DASHBOARD_MONTHS,
} from "../../components/dashboard/DashboardHeader";
import {
  DashboardKpis,
} from "../../components/dashboard/DashboardKPIs";
import {
  AgingPanel,
  EvolutionPanel,
  SellersPanel,
} from "../../components/dashboard/DashboardCharts";
import {
  AlertsPanel,
  CriticalPanel,
  DashboardFooter,
  OperationsPanel,
  TopClientsPanel,
} from "../../components/dashboard/DashboardTables";
import type {
  DashboardExecutiveFilters,
  DashboardExecutiveStats,
} from "../../types/dashboardExecutive";
import "./professional-dashboard.css";

type LegacyProps = {
  isMobile?: boolean;
  descuadresDetectados?: number;
  stats?: unknown;
  agingData?: unknown;
  topClientesData?: unknown;
  eficienciaCobranza?: unknown;
  vencimientosProximos?: unknown;
  analisisRetenciones?: unknown;
  analisisPorVendedor?: unknown;
  deudoresCronicos?: unknown;
  onOpenReports?: () => void;
};

export interface DashboardPageProps extends LegacyProps {
  executiveStats?: DashboardExecutiveStats | null;
  empresa?: {
    nombre?: string;
    administrador?: string;
  };
  dbPath?: string;
  onRefresh?: () => void | Promise<void>;
  onNavigate?: (
    target:
      | "reportes"
      | "creditos"
      | "anulados"
      | "gestion",
  ) => void;
}

function DashboardLoading() {
  return (
    <div className="powerbi-dashboard powerbi-dashboard--loading">
      <div className="bi-loader" />
      <h2>Actualizando inteligencia financiera</h2>
      <p>Consultando el periodo seleccionado.</p>
    </div>
  );
}

export function DashboardPage({
  executiveStats,
  descuadresDetectados = 0,
  onNavigate,
  onOpenReports,
}: DashboardPageProps) {
  const initialMonth =
    executiveStats?.periodo.selectedMonth ??
    new Date().getMonth() + 1;

  const initialYear =
    executiveStats?.periodo.selectedYear ??
    new Date().getFullYear();

  const [data, setData] =
    useState<DashboardExecutiveStats | null>(
      executiveStats || null,
    );

  const [selectedMonth, setSelectedMonth] =
    useState<number | null>(initialMonth);

  const [selectedYear, setSelectedYear] =
    useState<number>(initialYear);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (executiveStats) {
      setData(executiveStats);
    }
  }, [executiveStats]);

  const loadExecutiveData = useCallback(
    async (
      filters: DashboardExecutiveFilters,
    ): Promise<void> => {
      const electronApi = getElectronApi();
      const api = electronApi || createHttpApiClient();

      if (!api?.dashboardExecutiveStats) {
        return;
      }

      setLoading(true);

      try {
        const result =
          await api.dashboardExecutiveStats(filters);

        setData(result);
      } catch (error) {
        console.error(
          "Error cargando dashboard ejecutivo:",
          error,
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadExecutiveData({
      year: selectedYear,
      month: selectedMonth,
    });
  }, [
    loadExecutiveData,
    selectedMonth,
    selectedYear,
  ]);

  const availableYears = useMemo(() => {
    const years = data?.periodo.availableYears || [];

    if (years.length > 0) {
      return years;
    }

    const currentYear = new Date().getFullYear();

    return [
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2,
      currentYear + 3,
      currentYear + 4,
    ];
  }, [data]);

  if (!data) {
    return <DashboardLoading />;
  }

  const {
    cartera,
    cobrosMes,
    operacion,
    calidadDatos,
    aging,
    topClientes,
    carteraPorVendedor,
    moraCritica,
    alertas,
    historico,
    periodo,
  } = data;

  const selectedMonthLabel =
    selectedMonth === null
      ? "Todos los meses"
      : DASHBOARD_MONTHS.find(
          (month) => month.value === selectedMonth,
        )?.label || "Mes seleccionado";

  const navigateReports = () => {
    if (onNavigate) {
      onNavigate("reportes");
      return;
    }

    onOpenReports?.();
  };

  return (
    <div className="powerbi-dashboard">
      <DashboardHeader
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        availableYears={availableYears}
        qualityStatus={calidadDatos.estado}
        pendingCreditDocuments={
          operacion.documentosCreditoPendiente
        }
        unmatchedCancelledDocuments={
          operacion.anuladosNoEncontrados
        }
        onMonthChange={setSelectedMonth}
        onYearChange={setSelectedYear}
      />

      <DashboardKpis
        cartera={cartera}
        cobrosMes={cobrosMes}
        periodLabel={periodo.label}
        selectedMonth={selectedMonth}
      />

      <section className="bi-main-grid">
        <AgingPanel
          aging={aging}
          cartera={cartera}
        />

        <EvolutionPanel
          historico={historico}
          selectedMonth={selectedMonth}
          selectedMonthLabel={selectedMonthLabel}
          period={periodo}
        />

        <OperationsPanel
          operacion={operacion}
          calidadDatos={calidadDatos}
          onNavigate={onNavigate}
          onOpenReports={onOpenReports}
        />

        <TopClientsPanel
          topClientes={topClientes}
          onOpenReports={navigateReports}
        />

        <SellersPanel
          carteraPorVendedor={carteraPorVendedor}
        />

        <CriticalPanel
          moraCritica={moraCritica}
          onOpenReports={navigateReports}
        />

        <AlertsPanel
          alertas={alertas}
          onNavigate={onNavigate}
        />
      </section>

      <DashboardFooter
        cobrosMes={cobrosMes}
        descuadresDetectados={descuadresDetectados}
        periodLabel={periodo.label}
      />

      {loading && (
        <div className="bi-loading-overlay">
          <div className="bi-loader" />
        </div>
      )}
    </div>
  );
}
