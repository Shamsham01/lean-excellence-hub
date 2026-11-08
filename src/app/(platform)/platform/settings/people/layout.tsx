import { PlanModuleRouteGate } from "@/components/billing/plan-module-route-gate";

/**
 * Paid People HR surfaces (import, workforce provision, HR admin). Directory
 * access at /platform/people remains available without this layout.
 */
export default async function PeopleHrSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanModuleRouteGate module="people_hr">{children}</PlanModuleRouteGate>
  );
}
