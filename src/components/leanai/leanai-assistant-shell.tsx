import { Suspense, type ReactNode } from "react";

import { LeanAiAssistantChrome } from "@/components/leanai/leanai-assistant-chrome";
import { LeanAiAssistantProvider } from "@/components/leanai/leanai-assistant-provider";
import type { PlatformInAppNotification } from "@/modules/platform-shell/notifications";

export function LeanAiAssistantShell({
  organisationId,
  notifications,
  children,
}: {
  organisationId: string;
  notifications: {
    unreadCount: number;
    items: PlatformInAppNotification[];
  } | null;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="leanai-assistant-shell"
      className="flex h-full max-h-full min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      {children}
      <Suspense fallback={null}>
        <LeanAiAssistantProvider organisationId={organisationId}>
          <LeanAiAssistantChrome notifications={notifications} />
        </LeanAiAssistantProvider>
      </Suspense>
    </div>
  );
}
