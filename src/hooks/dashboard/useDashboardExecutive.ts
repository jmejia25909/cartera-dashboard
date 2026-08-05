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
  getDashboardMonthLabel,
  getFallbackDashboardYears,
} from "../../components/dashboard/dashboard.constants";
import type {
  DashboardExecutiveFilters,
  DashboardExecutiveStats,
} from "../../types/dashboardExecutive";

interface UseDashboardExecutiveResult {
  data: DashboardExecutiveStats | null;
  loading: boolean;
  selectedMonth: number | null;
  selectedYear: number;
  selectedMonthLabel: string;
  availableYears: number[];
  setSelectedMonth: (month: number | null) => void;
  setSelectedYear: (year: number) => void;
  refresh: () => Promise<void>;
}

export function useDashboardExecutive(
  initialStats?: DashboardExecutiveStats | null,
): UseDashboardExecutiveResult {
  const initialMonth =
    initialStats?.periodo.selectedMonth ??
    new Date().getMonth() + 1;

  const initialYear =
    initialStats?.periodo.selectedYear ??
    new Date().getFullYear();

  const [data, setData] =
    useState<DashboardExecutiveStats | null>(
      initialStats || null,
    );

  const [selectedMonth, setSelectedMonth] =
    useState<number | null>(initialMonth);

  const [selectedYear, setSelectedYear] =
    useState<number>(initialYear);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialStats) {
      setData(initialStats);
    }
  }, [initialStats]);

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

    return years.length > 0
      ? years
      : getFallbackDashboardYears();
  }, [data]);

  const selectedMonthLabel = useMemo(
    () => getDashboardMonthLabel(selectedMonth),
    [selectedMonth],
  );

  const refresh = useCallback(
    async (): Promise<void> => {
      await loadExecutiveData({
        year: selectedYear,
        month: selectedMonth,
      });
    },
    [
      loadExecutiveData,
      selectedMonth,
      selectedYear,
    ],
  );

  return {
    data,
    loading,
    selectedMonth,
    selectedYear,
    selectedMonthLabel,
    availableYears,
    setSelectedMonth,
    setSelectedYear,
    refresh,
  };
}
