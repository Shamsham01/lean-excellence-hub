"use server";

import { revalidatePath } from "next/cache";

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
    const data = await recordLeanAiSemanticEvent(input);
    if (input.eventKey.startsWith("leanai.intervention_")) {
      revalidatePath("/platform", "layout");
      revalidatePath("/onboarding/setup");
    }
    return { ok: true as const, data };
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
