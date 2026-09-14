"use client";

import { WorkspaceLoadError } from "@/components/platform/workspace-load-error";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <WorkspaceLoadError digest={error.digest} onRetry={reset} />;
}
