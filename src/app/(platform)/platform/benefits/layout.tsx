import { PlanModuleRouteGate } from "@/components/billing/plan-module-route-gate";

export default async function BenefitsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleRouteGate module="benefits">{children}</PlanModuleRouteGate>
  );
}
