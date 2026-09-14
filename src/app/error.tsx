"use client";

import { WorkspaceLoadError } from "@/components/platform/workspace-load-error";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <WorkspaceLoadError digest={error.digest} onRetry={reset} />;
}
