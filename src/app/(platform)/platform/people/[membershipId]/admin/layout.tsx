import { PlanModuleRouteGate } from "@/components/billing/plan-module-route-gate";

export default async function MembershipHrAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleRouteGate module="people_hr">{children}</PlanModuleRouteGate>
  );
}
