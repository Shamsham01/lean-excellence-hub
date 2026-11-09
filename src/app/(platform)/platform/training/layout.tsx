import { PlanModuleEntitlementShell } from "@/components/billing/plan-module-entitlement-shell";

export default async function TrainingModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleEntitlementShell module="training">
      {children}
    </PlanModuleEntitlementShell>
  );
}
