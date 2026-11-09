import { PlanModuleEntitlementShell } from "@/components/billing/plan-module-entitlement-shell";

export default async function RecognitionModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleEntitlementShell module="recognition">
      {children}
    </PlanModuleEntitlementShell>
  );
}
