import { PlanModuleEntitlementShell } from "@/components/billing/plan-module-entitlement-shell";

export default async function SkillsModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleEntitlementShell module="skills">{children}</PlanModuleEntitlementShell>
  );
}
