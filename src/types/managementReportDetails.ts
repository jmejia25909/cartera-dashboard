import type {
  ManagementReportFilters,
} from "./managementReports";

export type ManagementReportType =
  | "COLLECTIONS_DETAIL"
  | "CRM_ACTIVITY"
  | "PORTFOLIO_AGING"
  | "CANCELLED_DOCUMENTS"
  | "CREDIT_NOTES";

export interface ManagementReportDetailFilters
  extends ManagementReportFilters {
  customer?: string;
  seller?: string;
  movementClass?: "COBRO" | "CRUCE" | null;
  reconciliationStatus?: string | null;
}

export interface ManagementReportDetailRequest {
  type: ManagementReportType;
  filters: ManagementReportDetailFilters;
}

export interface ManagementReportDetailResult {
  type: ManagementReportType;

  period: {
    year: number;
    month: number | null;
    from: string;
    toExclusive: string;
    label: string;
  };

  rows: Array<Record<string, unknown>>;
  totals: Record<string, number>;
}

