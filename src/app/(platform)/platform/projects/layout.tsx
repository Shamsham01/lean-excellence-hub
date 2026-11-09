import { PlanModuleEntitlementShell } from "@/components/billing/plan-module-entitlement-shell";

export default async function ProjectsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleEntitlementShell module="projects">
      {children}
    </PlanModuleEntitlementShell>
  );
}
