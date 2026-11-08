import type { Metadata } from "next";

import { LeanAiCostPanel } from "@/components/platform-admin/leanai-cost-panel";
import { loadPlatformLeanAiCostReport } from "@/modules/platform-admin/data";
import { resolvePlatformConsoleAccess } from "@/modules/platform-admin/gate";
import { readRequestPathname } from "@/platform/http/request-path";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "LeanAI cost governance",
};

export default async function PlatformLeanAiCostPage() {
  const access = await resolvePlatformConsoleAccess();
  if (access.kind !== "allowed") {
    return null;
  }
  const requestPath = await readRequestPathname();
  const report = await loadPlatformLeanAiCostReport({
    requestPath,
    userId: access.userId,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          LeanAI cost governance
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Internal provider cost estimates for platform operators. Customers do
          not see USD figures, margins, or other tenants. Figures are planning
          estimates from the versioned rate card — not invoices.
        </p>
      </div>
      <LeanAiCostPanel report={report} />
    </div>
  );
}
