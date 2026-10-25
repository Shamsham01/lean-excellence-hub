import { EditorialHome } from "./editorial/home";
import { MarketingShell } from "./shell";

export function MarketingHome() {
  return (
    <MarketingShell>
      <EditorialHome />
    </MarketingShell>
  );
}
