import type {
  DashboardDataQualityStatus,
} from "../../types/dashboardExecutive";

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

interface DashboardHeaderProps {
  selectedMonth: number | null;
  selectedYear: number;
  availableYears: number[];
  qualityStatus: DashboardDataQualityStatus;
  pendingCreditDocuments: number;
  unmatchedCancelledDocuments: number;
  onMonthChange: (month: number | null) => void;
  onYearChange: (year: number) => void;
}

export function DashboardHeader({
  selectedMonth,
  selectedYear,
  availableYears,
  qualityStatus,
  pendingCreditDocuments,
  unmatchedCancelledDocuments,
  onMonthChange,
  onYearChange,
}: DashboardHeaderProps) {
  return (
    <section className="bi-filterbar">
      <div className="bi-month-filter">
        <strong>Filtrar por mes:</strong>

        {DASHBOARD_MONTHS.map((month) => (
          <button
            key={month.value}
            type="button"
            className={
              selectedMonth === month.value
                ? "is-active"
                : ""
            }
            onClick={() => onMonthChange(month.value)}
          >
            {month.label}
          </button>
        ))}

        <button
          type="button"
          className={
            selectedMonth === null ? "is-active" : ""
          }
          onClick={() => onMonthChange(null)}
        >
          Todos
        </button>
      </div>

      <div className="bi-filterbar__right">
        <span
          className={`bi-data-state bi-data-state--${qualityStatus.toLowerCase()}`}
          title={
            `${pendingCreditDocuments} documentos con crédito pendiente · ` +
            `${unmatchedCancelledDocuments} anulados no encontrados`
          }
        >
          ● Calidad del dato: {qualityStatus}
        </span>

        <label className="bi-year-filter">
          <span>Año</span>
          <select
            value={selectedYear}
            onChange={(event) =>
              onYearChange(Number(event.target.value))
            }
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
