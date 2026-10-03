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
    <div
      data-testid="leanai-assistant-shell"
      className="flex min-h-0 min-w-0 flex-1 lg:h-full lg:max-h-full lg:overflow-hidden"
    >
      {children}
      <Suspense fallback={null}>
        <LeanAiAssistantProvider organisationId={organisationId}>
          <LeanAiAssistantChrome />
        </LeanAiAssistantProvider>
      </Suspense>
    </div>
  );
}
