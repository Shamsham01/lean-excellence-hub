import { Suspense, type ReactNode } from "react";

import { LeanAiAssistantChrome } from "@/components/leanai/leanai-assistant-chrome";
import { LeanAiAssistantProvider } from "@/components/leanai/leanai-assistant-provider";

export function LeanAiAssistantShell({
  organisationId,
  children,
}: {
  organisationId: string;
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={<div className="flex min-h-0 min-w-0 flex-1">{children}</div>}
    >
      <LeanAiAssistantProvider organisationId={organisationId}>
        <div className="flex min-h-0 min-w-0 flex-1">
          {children}
          <LeanAiAssistantChrome />
        </div>
      </LeanAiAssistantProvider>
    </Suspense>
  );
}
