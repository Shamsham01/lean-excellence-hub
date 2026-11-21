import { MarketingShell } from "./shell";
import { V6Landing } from "./v6/landing";

export function MarketingHome() {
  return (
    <MarketingShell>
      <V6Landing />
    </MarketingShell>
  );
}
