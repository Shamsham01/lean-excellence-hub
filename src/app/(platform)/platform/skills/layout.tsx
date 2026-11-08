import { PlanModuleRouteGate } from "@/components/billing/plan-module-route-gate";

export default async function SkillsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlanModuleRouteGate module="skills">{children}</PlanModuleRouteGate>;
}
