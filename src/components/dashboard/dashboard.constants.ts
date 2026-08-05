export const DASHBOARD_MONTHS = [
  { value: 1, label: "Ene" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Abr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Ago" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dic" },
] as const;

export const DASHBOARD_CHART_COLORS = [
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#f97316",
  "#ef4444",
] as const;

export const getDashboardMonthLabel = (
  month: number | null,
): string => {
  if (month === null) {
    return "Todos los meses";
  }

  return (
    DASHBOARD_MONTHS.find(
      (item) => item.value === month,
    )?.label || "Mes seleccionado"
  );
};

export const getFallbackDashboardYears = (): number[] => {
  const currentYear = new Date().getFullYear();

  return [
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3,
    currentYear + 4,
  ];
};
