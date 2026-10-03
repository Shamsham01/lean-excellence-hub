export const LEANAI_ASSISTANT_OPEN_EVENT = "leanai-assistant-open";

export function requestLeanAiAssistantOpen(message?: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(LEANAI_ASSISTANT_OPEN_EVENT, {
      detail: { message },
    }),
  );
}
