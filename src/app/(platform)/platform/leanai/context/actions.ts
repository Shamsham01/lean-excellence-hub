"use server";

import {
  loadLeanAiContextualSnapshot,
  recordLeanAiSemanticEvent,
} from "@/modules/leanai-context/queries";
import type { LeanAiSemanticEventInput } from "@/modules/leanai-context/types";

export async function getLeanAiContextualSnapshotAction() {
  try {
    return { ok: true as const, data: await loadLeanAiContextualSnapshot() };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load LeanAI context.",
    };
  }
}

export async function recordLeanAiSemanticEventAction(
  input: LeanAiSemanticEventInput,
) {
  try {
    return { ok: true as const, data: await recordLeanAiSemanticEvent(input) };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Unable to record LeanAI event.",
    };
  }
}
