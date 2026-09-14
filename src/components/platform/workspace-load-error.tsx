"use client";

import { Button } from "@/components/ui/button";

export function WorkspaceLoadError({
  title = "This workspace couldn’t load",
  description = "The page failed to reload. Your previous action may already have been saved. Reload before repeating it.",
  digest,
  onRetry,
}: {
  title?: string;
  description?: string;
  digest?: string | undefined;
  onRetry: () => void;
}) {
  return (
    <div
      className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-16"
      data-testid="workspace-load-error"
    >
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      {digest ? (
        <p className="text-xs text-muted-foreground" data-testid="error-digest">
          Reference {digest}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" className="min-h-11" onClick={onRetry}>
          Try again
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              onRetry();
            }
          }}
        >
          Go back
        </Button>
      </div>
    </div>
  );
}
