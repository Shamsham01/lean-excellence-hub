import {
  createPlatformBoundaryReference,
  logPlatformBoundaryError,
  sanitizeBoundaryMessage,
} from "@/platform/observability/platform-boundary";

function reportClientRuntimeError(error: unknown, operation: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown client error";
  logPlatformBoundaryError({
    category: "request",
    operation,
    reference: createPlatformBoundaryReference(),
    supabaseMessage: sanitizeBoundaryMessage(message),
    renderSource: "instrumentation-client",
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    reportClientRuntimeError(
      event.error ?? event.message,
      "client_window_error",
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportClientRuntimeError(event.reason, "client_unhandled_rejection");
  });
}
