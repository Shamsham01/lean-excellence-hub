import { PlanModuleRouteGate } from "@/components/billing/plan-module-route-gate";

export default async function RecognitionModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleRouteGate module="recognition">{children}</PlanModuleRouteGate>
  );
}
