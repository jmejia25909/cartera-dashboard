import {
  DashboardHeader,
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
import {
  useDashboardExecutive,
} from "../../hooks/dashboard/useDashboardExecutive";
import type {
  DashboardExecutiveStats,
} from "../../types/dashboardExecutive";
import type {
  DashboardNavigationTarget,
} from "../../types/dashboardNavigation";
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
    target: DashboardNavigationTarget,
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
  const {
    data,
    loading,
    selectedMonth,
    selectedYear,
    selectedMonthLabel,
    availableYears,
    setSelectedMonth,
    setSelectedYear,
  } = useDashboardExecutive(executiveStats);

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
