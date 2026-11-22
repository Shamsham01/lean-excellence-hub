import { PlanModuleEntitlementShell } from "@/components/billing/plan-module-entitlement-shell";

export default async function ProblemSolvingModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleEntitlementShell module="problem_solving">
      {children}
    </PlanModuleEntitlementShell>
  );
}
