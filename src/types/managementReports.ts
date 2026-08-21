export interface ManagementReportFilters {
  year: number;
  month?: number | null;
}

export type DataFreshnessStatus =
  | "UPDATED"
  | "PARTIAL"
  | "NO_DATA";

export interface DataFreshnessSource {
  type: string;
  label: string;
  lastImport: string | null;
  periodUntil: string | null;
  status: DataFreshnessStatus;
}

export interface ManagementReportsSummary {
  period: {
    year: number;
    month: number | null;
    from: string;
    toExclusive: string;
    label: string;
  };

  freshness: {
    status: "UPDATED" | "WARNING";
    canIssueOfficialReport: boolean;
    sources: DataFreshnessSource[];
    warnings: string[];
  };

  collections: {
    movements: number;
    total: number;
    collections: number;
    crossings: number;
    reconciled: number;
    pendingReconciliation: number;
  };

  crm: {
    contacts: number;
    customers: number;
    promises: number;
    promisedAmount: number;
    overduePromises: number;
  };

  audit: {
    cancelledDocuments: number;
    creditNotes: number;
    creditNotesAmount: number;
  };
}
