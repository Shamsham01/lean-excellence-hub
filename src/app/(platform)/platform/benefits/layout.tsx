import { PlanModuleEntitlementShell } from "@/components/billing/plan-module-entitlement-shell";

export default async function BenefitsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleEntitlementShell module="benefits">{children}</PlanModuleEntitlementShell>
  );
}
