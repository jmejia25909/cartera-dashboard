import {
  DashboardPage as ProfessionalDashboardPage,
  type DashboardPageProps,
} from "./ProfessionalDashboardPage";

export type { DashboardPageProps };

export function DashboardPage(
  props: DashboardPageProps,
) {
  return (
    <ProfessionalDashboardPage {...props} />
  );
}
