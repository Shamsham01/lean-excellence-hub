"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createModuleSetupDraftFromProposal,
  discardModuleSetupBuilderConversation,
  sendModuleSetupBuilderMessage,
} from "@/modules/module-setup/ai-builder/execute";
import type { ModuleSetupBuilderSnapshot } from "@/modules/module-setup/ai-builder/snapshot";
import { readApplicableUnitIds } from "@/modules/operational/five-s-applicability";
import { fiveSSetupBuilderModule } from "@/modules/5s/ai-builder/module";
import { fiveSBuilderSnapshot } from "@/modules/5s/ai-builder/view";
import {
  buildFiveSQuickStartDefinition,
  parseFiveSThreshold,
  requireCanonicalFiveSTemplate,
} from "@/modules/5s/templates";
import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

function snapshotFrom<T extends { conversation: unknown }>(result: T) {
  if (!result || typeof result !== "object" || !("conversation" in result)) {
    return result;
  }
  const conversation = (
    result as {
      conversation: Parameters<typeof fiveSBuilderSnapshot>[0] | null;
    }
  ).conversation;
  return {
    ...result,
    conversation: conversation ? fiveSBuilderSnapshot(conversation) : null,
  };
}

export async function sendFiveSSetupBuilderMessage(input: {
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
    fiveSSetupBuilderModule,
    input,
  );
  return snapshotFrom(result) as Awaited<
    ReturnType<typeof sendFiveSSetupBuilderMessage>
  >;
}

export async function createFiveSDraftFromProposal(formData: FormData) {
  return createModuleSetupDraftFromProposal(fiveSSetupBuilderModule, formData);
}

export async function discardFiveSSetupBuilderConversation() {
  return discardModuleSetupBuilderConversation(fiveSSetupBuilderModule);
}

export async function deployFiveSQuickStart(formData: FormData) {
  const templateKey = String(formData.get("templateKey") ?? "");
  let template;
  try {
    template = requireCanonicalFiveSTemplate(templateKey);
  } catch {
    return { error: "That starting point is not available." };
  }
  const threshold = parseFiveSThreshold(formData.get("threshold"));
  if (threshold == null) {
    return { error: "Enter a target threshold between 0 and 100." };
  }
  const unitIds = readApplicableUnitIds(formData);
  if (unitIds.length === 0) {
    return {
      error: "Select at least one applicable area before creating the draft.",
    };
  }

  const definition = buildFiveSQuickStartDefinition(template, threshold);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_five_s_standard_draft_from_definition",
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
  revalidatePath("/platform/5s");
  revalidatePath("/platform/5s/standards");
  redirect(`/platform/5s/standards/${data}`);
}
