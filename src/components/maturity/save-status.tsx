export type FieldSaveState = "idle" | "saving" | "saved" | "error";

export function SaveStatus({
  state,
  error,
  onRetry,
}: {
  state: FieldSaveState;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (state === "saving") {
    return (
      <p className="typography-caption mt-2" data-testid="save-state-saving">
        Saving…
      </p>
    );
  }
  if (state === "saved") {
    return (
      <p
        className="typography-caption mt-2 text-success"
        data-testid="save-state-saved"
      >
        Saved
      </p>
    );
  }
  if (state === "error") {
    return (
      <p
        className="mt-2 flex flex-wrap items-center gap-2 text-sm text-destructive"
        role="alert"
      >
        <span>Could not save —</span>
        {onRetry ? (
          <button
            type="button"
            className="underline"
            onClick={onRetry}
            data-testid="save-retry"
          >
            Retry
          </button>
        ) : (
          <span>Retry</span>
        )}
        {error ? <span className="text-xs">{error}</span> : null}
      </p>
    );
  }
  return null;
}
