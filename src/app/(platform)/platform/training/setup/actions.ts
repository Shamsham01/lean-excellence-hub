"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  discardModuleSetupBuilderConversation,
  loadModuleSetupBuilderConversation,
  sendModuleSetupBuilderMessage,
} from "@/modules/module-setup/ai-builder/execute";
import { trainingBuilderSnapshot } from "@/modules/training/ai-builder/view";
import { trainingSetupBuilderModule } from "@/modules/training/ai-builder/module";
import { trainingProposalToDefinition } from "@/modules/training/ai-builder/proposal";
import { toTrainingCatalogErrorMessage } from "@/modules/training/catalog-errors";
import { buildStarterPackDefinition } from "@/modules/training/setup/definition";
import {
  leanAiPreparationSchema,
  manualPreparationToDefinition,
  manualTrainingPreparationSchema,
  quickStartPreparationSchema,
  renewTrainingPreparationKey,
} from "@/modules/training/setup/preparation";
import type {
  ManualTrainingPreparation,
  QuickStartPreparation,
} from "@/modules/training/setup/preparation";
import { requireTrainingStarterPack } from "@/modules/training/templates/catalogue";
import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateTrainingSetup() {
  revalidatePath("/platform/training");
  revalidatePath("/platform/training/setup");
  revalidatePath("/platform/training/courses");
  revalidatePath("/platform/training/curriculum");
}

async function organisationLists() {
  const supabase = await createServerSupabaseClient();
  const [{ data: jobFunctions }, { data: courses }, { data: curricula }] =
    await Promise.all([
      supabase.from("job_functions").select("id").eq("status", "active"),
      supabase.from("training_courses").select("code"),
      supabase.from("training_curricula").select("code"),
    ]);
  return {
    supabase,
    jobFunctionIds: new Set((jobFunctions ?? []).map((row) => row.id)),
    courseCodes: (courses ?? []).map((row) => row.code),
    curriculumCodes: (curricula ?? []).map((row) => row.code),
  };
}

async function readPreparation(source: string, templateKey: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("training_setup_preparations")
    .select("state")
    .eq("source", source)
    .eq("template_key", templateKey)
    .maybeSingle();
  return data?.state;
}

export async function saveTrainingSetupPreparation(input: {
  source: "manual" | "quick_start" | "leanai";
  templateKey?: string;
  state: unknown;
}) {
  const templateKey = input.templateKey ?? "";
  const state =
    input.source === "manual"
      ? manualTrainingPreparationSchema.safeParse(input.state)
      : input.source === "quick_start"
        ? quickStartPreparationSchema.safeParse(input.state)
        : leanAiPreparationSchema.safeParse(input.state);
  if (!state.success) {
    return { error: "Those setup choices could not be saved. Try again." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("save_training_setup_preparation", {
    target_source: input.source,
    target_template_key: templateKey,
    target_state: state.data as unknown as Json,
  });
  if (error) {
    return {
      error: toTrainingCatalogErrorMessage(
        error,
        "The setup could not be saved. Try again.",
      ),
    };
  }
  return { ok: true as const };
}

export async function createManualTrainingSetupDraft(
  state: ManualTrainingPreparation,
) {
  const lists = await organisationLists();
  const defined = manualPreparationToDefinition(
    state,
    lists.courseCodes,
    lists.curriculumCodes,
  );
  if (!defined.ok) {
    return { error: defined.message };
  }
  const created = await lists.supabase.rpc("create_training_setup_draft", {
    target_idempotency_key: state.idempotencyKey,
    target_definition: defined.definition as unknown as Json,
  });
  if (created.error || !created.data) {
    return {
      error: toTrainingCatalogErrorMessage(
        created.error,
        "The draft could not be created. Nothing was saved or published.",
      ),
    };
  }
  revalidateTrainingSetup();
  redirect(`/platform/training/setup/drafts/${created.data}`);
}

export async function deployTrainingQuickStart(input: {
  packKey: string;
  preparation: QuickStartPreparation;
}) {
  const pack = requireTrainingStarterPack(input.packKey);
  const lists = await organisationLists();
  const defined = buildStarterPackDefinition({
    pack,
    roleMappings: input.preparation.roleMappings,
    existingCourseCodes: lists.courseCodes,
    existingCurriculumCodes: lists.curriculumCodes,
  });
  if (!defined.ok) {
    return { error: defined.message };
  }
  const created = await lists.supabase.rpc("create_training_setup_draft", {
    target_idempotency_key: input.preparation.idempotencyKey,
    target_definition: defined.definition as unknown as Json,
  });
  if (created.error || !created.data) {
    return {
      error: toTrainingCatalogErrorMessage(
        created.error,
        "The draft could not be created. Nothing was saved or published.",
      ),
    };
  }
  revalidateTrainingSetup();
  redirect(`/platform/training/setup/drafts/${created.data}`);
}

export async function publishTrainingSetupBundle(formData: FormData) {
  const bundleId = String(formData.get("bundleId") ?? "");
  if (!UUID_PATTERN.test(bundleId)) {
    return { error: "That setup draft could not be found." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("publish_training_setup_bundle", {
    target_bundle_id: bundleId,
  });
  if (error) {
    return {
      error: toTrainingCatalogErrorMessage(
        error,
        "The setup could not be published. The draft is still here.",
      ),
    };
  }
  revalidateTrainingSetup();
  redirect("/platform/training/courses");
}

export async function discardTrainingSetupBundle(formData: FormData) {
  const bundleId = String(formData.get("bundleId") ?? "");
  if (!UUID_PATTERN.test(bundleId)) {
    return { error: "That setup draft could not be found." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("discard_training_setup_bundle", {
    target_bundle_id: bundleId,
  });
  if (error) {
    return {
      error: toTrainingCatalogErrorMessage(
        error,
        "The draft could not be discarded.",
      ),
    };
  }
  revalidateTrainingSetup();
  redirect("/platform/training/setup");
}

export async function sendTrainingSetupBuilderMessage(input: {
  message?: string;
  intent: "answer" | "propose" | "refine" | "retry";
  focus?: unknown;
  idempotencyKey?: string;
}) {
  const result = await sendModuleSetupBuilderMessage(
    trainingSetupBuilderModule,
    input,
  );
  const snapshot = result.conversation
    ? trainingBuilderSnapshot(result.conversation)
    : null;
  if (!result.ok) {
    return {
      ok: false as const,
      reason: result.reason,
      message: result.message,
      conversation: snapshot,
    };
  }
  if (!snapshot) {
    return {
      ok: false as const,
      reason: "provider_error" as const,
      message: "LeanAI could not load the conversation.",
      conversation: null,
    };
  }
  return {
    ok: true as const,
    outcome: result.outcome,
    conversation: snapshot,
  };
}

export async function createTrainingDraftFromProposal(
  formData: FormData,
): Promise<{ ok: true; redirectTo: string } | { ok: false; message: string }> {
  const proposalMessageId = String(formData.get("proposalMessageId") ?? "");
  if (!UUID_PATTERN.test(proposalMessageId)) {
    return { ok: false, message: "Choose a proposal to create." };
  }
  const stored = await readPreparation("leanai", "leanai-training-builder");
  const parsed = leanAiPreparationSchema.safeParse(stored);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Save role mappings before creating the draft.",
    };
  }
  const lists = await organisationLists();
  const supabase = lists.supabase;
  const { data: sessionRow } = await supabase
    .from("ai_sessions")
    .select("id, organisation_id")
    .eq("context_type", "coach")
    .eq("module_key", "training")
    .eq("intervention_key", "setup_builder")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sessionRow) {
    return {
      ok: false,
      message: "The setup conversation could not be found.",
    };
  }
  const conversation = await loadModuleSetupBuilderConversation(
    trainingSetupBuilderModule,
    sessionRow.organisation_id,
  );
  const current = conversation?.currentProposal ?? null;
  if (!current || current.messageId !== proposalMessageId) {
    return {
      ok: false,
      message:
        "This proposal is no longer the latest one. Review the current proposal first.",
    };
  }
  const defined = trainingProposalToDefinition({
    proposal: current.proposal,
    roleMappings: parsed.data.roleMappings,
    allowedJobFunctionIds: lists.jobFunctionIds,
    existingCourseCodes: lists.courseCodes,
    existingCurriculumCodes: lists.curriculumCodes,
  });
  if (!defined.ok) {
    return { ok: false, message: defined.message };
  }
  const created = await supabase.rpc("create_training_setup_draft", {
    target_idempotency_key: parsed.data.idempotencyKey,
    target_definition: defined.definition as unknown as Json,
  });
  if (created.error || !created.data) {
    return {
      ok: false,
      message: toTrainingCatalogErrorMessage(
        created.error,
        "The draft could not be created.",
      ),
    };
  }
  revalidateTrainingSetup();
  return {
    ok: true,
    redirectTo: `/platform/training/setup/drafts/${created.data}`,
  };
}

export async function discardTrainingSetupBuilderConversation() {
  return discardModuleSetupBuilderConversation(trainingSetupBuilderModule);
}

export async function startNewTrainingSetup(input: {
  source: "manual" | "quick_start" | "leanai";
  templateKey?: string;
  state: unknown;
}) {
  const templateKey = input.templateKey ?? "";
  const parsed =
    input.source === "manual"
      ? manualTrainingPreparationSchema.safeParse(input.state)
      : quickStartPreparationSchema.safeParse(input.state);
  if (!parsed.success) {
    return { error: "Those setup choices could not be started." };
  }
  const renewed = renewTrainingPreparationKey(parsed.data, randomUUID());
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("save_training_setup_preparation", {
    target_source: input.source,
    target_template_key: templateKey,
    target_state: renewed as unknown as Json,
  });
  return { preparation: renewed };
}
