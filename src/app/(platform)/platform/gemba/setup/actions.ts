"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { gembaSetupBuilderModule } from "@/modules/gemba/ai-builder/module";
import { gembaBuilderSnapshot } from "@/modules/gemba/ai-builder/view";
import {
  buildGembaQuickStartDefinition,
  requireCanonicalGembaTemplate,
} from "@/modules/gemba/templates";
import {
  createModuleSetupDraftFromProposal,
  discardModuleSetupBuilderConversation,
  sendModuleSetupBuilderMessage,
} from "@/modules/module-setup/ai-builder/execute";
import type { ModuleSetupBuilderSnapshot } from "@/modules/module-setup/ai-builder/snapshot";
import { readApplicableUnitIds } from "@/modules/operational/gemba-applicability";
import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function sendGembaSetupBuilderMessage(input: {
  message?: string;
  intent: "answer" | "propose" | "refine" | "retry";
  focus?: unknown;
  idempotencyKey?: string;
}): Promise<
  | {
      ok: true;
      outcome: "ok" | "invalid_response" | "invalid_proposal";
      conversation: ModuleSetupBuilderSnapshot;
    }
  | {
      ok: false;
      reason: string;
      message: string;
      conversation: ModuleSetupBuilderSnapshot | null;
    }
> {
  const result = await sendModuleSetupBuilderMessage(
    gembaSetupBuilderModule,
    input,
  );
  return {
    ...result,
    conversation: result.conversation
      ? gembaBuilderSnapshot(result.conversation)
      : null,
  } as Awaited<ReturnType<typeof sendGembaSetupBuilderMessage>>;
}

export async function createGembaDraftFromProposal(formData: FormData) {
  return createModuleSetupDraftFromProposal(gembaSetupBuilderModule, formData);
}

export async function discardGembaSetupBuilderConversation() {
  return discardModuleSetupBuilderConversation(gembaSetupBuilderModule);
}

export async function deployGembaQuickStart(formData: FormData) {
  const templateKey = String(formData.get("templateKey") ?? "");
  let template;
  try {
    template = requireCanonicalGembaTemplate(templateKey);
  } catch {
    return { error: "That starting point is not available." };
  }
  const unitIds = readApplicableUnitIds(formData);
  if (unitIds.length === 0) {
    return {
      error: "Select at least one applicable area before creating the draft.",
    };
  }
  const definition = buildGembaQuickStartDefinition(template);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_gemba_definition_draft_from_definition",
    {
      target_declared_template_key: template.key,
      target_definition: definition as unknown as Json,
      target_unit_ids: unitIds,
    },
  );
  if (error || !data) {
    return {
      error:
        "The draft could not be created. Nothing was saved or published. You can try again.",
    };
  }
  revalidatePath("/platform/gemba");
  revalidatePath("/platform/gemba/definitions");
  redirect(`/platform/gemba/definitions/${data}`);
}
