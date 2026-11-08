import { PlanModuleRouteGate } from "@/components/billing/plan-module-route-gate";

export default async function TrainingModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleRouteGate module="training">{children}</PlanModuleRouteGate>
  );
}
