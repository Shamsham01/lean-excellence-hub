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
    <div className="flex min-h-0 min-w-0 flex-1">
      {children}
      <Suspense fallback={null}>
        <LeanAiAssistantProvider organisationId={organisationId}>
          <LeanAiAssistantChrome />
        </LeanAiAssistantProvider>
      </Suspense>
    </div>
  );
}
