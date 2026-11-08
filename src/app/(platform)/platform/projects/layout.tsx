import { PlanModuleRouteGate } from "@/components/billing/plan-module-route-gate";

export default async function ProjectsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleRouteGate module="projects">{children}</PlanModuleRouteGate>
  );
}
