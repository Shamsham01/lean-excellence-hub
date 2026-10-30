import "server-only";

import { randomUUID } from "node:crypto";

import {
  resolveSkillsPreparationVisit,
  skillsCreationKeyState,
} from "@/modules/skills/setup/preparation";
import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function resumeSkillsPreparation<
  T extends { idempotencyKey: string },
>(input: {
  source: "manual" | "quick_start" | "leanai";
  templateKey: string;
  saved: unknown;
  parse: (value: unknown) => T | null;
  fresh: () => T;
}): Promise<T> {
  const parsed = input.parse(input.saved);
  const supabase = await createServerSupabaseClient();
  let creationKeyState = skillsCreationKeyState(null);
  if (parsed) {
    const { data } = await supabase
      .from("skill_setup_bundles")
      .select("status")
      .eq("idempotency_key", parsed.idempotencyKey)
      .maybeSingle();
    creationKeyState = skillsCreationKeyState(data?.status);
  }
  const visit = resolveSkillsPreparationVisit({
    saved: parsed,
    creationKeyState,
    fresh: input.fresh,
    replacementKey: randomUUID(),
  });
  if (visit.mode === "new_setup") {
    await supabase.rpc("save_skill_setup_preparation", {
      target_source: input.source,
      target_template_key: input.templateKey,
      target_state: visit.preparation as unknown as Json,
    });
  }
  return visit.preparation;
}
