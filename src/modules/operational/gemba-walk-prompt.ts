export const GEMBA_WALK_PROMPT_STORAGE_PREFIX = "gemba-walk-prompt:";
export const GEMBA_WALK_PROMPT_PARAM = "prompt";

export function gembaWalkPath(walkId: string) {
  return `/platform/gemba/walks/${walkId}`;
}

export function gembaWalkPromptStorageKey(walkId: string) {
  return `${GEMBA_WALK_PROMPT_STORAGE_PREFIX}${walkId}`;
}

export function readStoredGembaWalkPromptId(walkId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(gembaWalkPromptStorageKey(walkId));
  } catch {
    return null;
  }
}

export function writeStoredGembaWalkPromptId(
  walkId: string,
  questionId: string,
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      gembaWalkPromptStorageKey(walkId),
      questionId,
    );
  } catch {
    // Ignore quota / private-mode failures; URL remains the primary restore path.
  }
}

export function clearStoredGembaWalkPromptId(walkId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(gembaWalkPromptStorageKey(walkId));
  } catch {
    // Ignore storage access failures.
  }
}

export function readGembaWalkPromptIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const value = params.get(GEMBA_WALK_PROMPT_PARAM)?.trim();
  return value ? value : null;
}

export function buildGembaWalkPromptSearch(questionId: string) {
  const params = new URLSearchParams();
  params.set(GEMBA_WALK_PROMPT_PARAM, questionId);
  return `?${params.toString()}`;
}

export function subscribeGembaWalkPromptLocation(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<History["pushState"]>) => {
    const before = window.location.search;
    const result = originalPushState(...args);
    if (window.location.search !== before) {
      onStoreChange();
    }
    return result;
  };
  history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    const before = window.location.search;
    const result = originalReplaceState(...args);
    if (window.location.search !== before) {
      onStoreChange();
    }
    return result;
  };
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
}

export function resolveGembaWalkPromptIndex({
  questionIds,
  preferredQuestionId,
  storedQuestionId,
}: {
  questionIds: string[];
  preferredQuestionId?: string | null;
  storedQuestionId?: string | null;
}) {
  if (questionIds.length === 0) return 0;

  for (const candidate of [preferredQuestionId, storedQuestionId]) {
    if (!candidate) continue;
    const index = questionIds.indexOf(candidate);
    if (index >= 0) return index;
  }

  return 0;
}

/** URL identity wins; session storage is only used when the URL has no prompt param. */
export function resolveGembaWalkPromptId({
  windowPromptId,
  routerPromptId,
}: {
  windowPromptId?: string | null;
  routerPromptId?: string | null;
}) {
  const windowId = windowPromptId ?? null;
  const routerId = routerPromptId ?? null;
  if (windowId && routerId && windowId !== routerId) {
    return windowId;
  }
  return routerId ?? windowId;
}

export function resolveActiveGembaWalkPromptIndex({
  questionIds,
  urlPromptId,
  initialPromptId,
  storedPromptId,
}: {
  questionIds: string[];
  urlPromptId?: string | null;
  initialPromptId?: string | null;
  storedPromptId?: string | null;
}) {
  if (urlPromptId) {
    return resolveGembaWalkPromptIndex({
      questionIds,
      preferredQuestionId: urlPromptId,
      storedQuestionId: urlPromptId,
    });
  }

  return resolveGembaWalkPromptIndex({
    questionIds,
    ...(initialPromptId != null
      ? { preferredQuestionId: initialPromptId }
      : {}),
    ...(storedPromptId != null ? { storedQuestionId: storedPromptId } : {}),
  });
}
