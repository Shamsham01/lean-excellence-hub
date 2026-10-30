"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  loadModuleSetupBuilderConversation,
  sendModuleSetupBuilderMessage,
} from "@/modules/module-setup/ai-builder/execute";
import { skillsSetupBuilderModule } from "@/modules/skills/ai-builder/module";
import { skillsProposalToDefinition } from "@/modules/skills/ai-builder/proposal";
import type { SkillsBuilderProposal } from "@/modules/skills/ai-builder/types";
import { toSkillsAuthoringError } from "@/modules/skills/errors";
import { buildStarterPackDefinition } from "@/modules/skills/setup/definition";
import {
  assertConfirmedSetupUnits,
  leanAiPreparationSchema,
  manualPreparationToDefinition,
  manualSkillsPreparationSchema,
  quickStartPreparationSchema,
  renewSkillsPreparationKey,
} from "@/modules/skills/setup/preparation";
import type {
  ManualSkillsPreparation,
  QuickStartPreparation,
} from "@/modules/skills/setup/preparation";
import { requireSkillsStarterPack } from "@/modules/skills/templates/catalogue";
import type { Json } from "@/platform/supabase/database.types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateSkillsSetup() {
  revalidatePath("/platform/skills");
  revalidatePath("/platform/skills/setup");
  revalidatePath("/platform/skills/catalog");
  revalidatePath("/platform/skills/scales");
  revalidatePath("/platform/skills/standards");
  revalidatePath("/platform/skills/matrix");
}

async function organisationAllowLists() {
  const supabase = await createServerSupabaseClient();
  const [{ data: jobFunctions }, { data: units }] = await Promise.all([
    supabase.from("job_functions").select("id").eq("status", "active"),
    supabase.from("organisation_units").select("id").eq("status", "active"),
  ]);
  return {
    supabase,
    jobFunctionIds: new Set((jobFunctions ?? []).map((row) => row.id)),
    unitIds: new Set((units ?? []).map((row) => row.id)),
  };
}

export async function saveSkillsSetupPreparation(input: {
  source: "manual" | "quick_start" | "leanai";
  templateKey?: string;
  state: unknown;
}) {
  const templateKey = input.templateKey ?? "";
  const state =
    input.source === "manual"
      ? manualSkillsPreparationSchema.safeParse(input.state)
      : input.source === "quick_start"
        ? quickStartPreparationSchema.safeParse(input.state)
        : leanAiPreparationSchema.safeParse(input.state);
  if (!state.success) {
    return {
      error:
        "Those setup choices could not be saved. Check the fields and try again.",
    };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("save_skill_setup_preparation", {
    target_source: input.source,
    target_template_key: templateKey,
    target_state: state.data as unknown as Json,
  });
  if (error) {
    return {
      error: toSkillsAuthoringError(
        error,
        "The setup could not be saved. Try again.",
      ),
    };
  }
  return { ok: true as const };
}

export async function startNewSkillsSetup(input: {
  source: "manual";
  templateKey?: string;
  state: unknown;
}): Promise<{ preparation: ManualSkillsPreparation } | { error: string }>;
export async function startNewSkillsSetup(input: {
  source: "quick_start" | "leanai";
  templateKey?: string;
  state: unknown;
}): Promise<{ preparation: QuickStartPreparation } | { error: string }>;
export async function startNewSkillsSetup(input: {
  source: "manual" | "quick_start" | "leanai";
  templateKey?: string;
  state: unknown;
}): Promise<
  | { preparation: ManualSkillsPreparation | QuickStartPreparation }
  | { error: string }
> {
  const templateKey = input.templateKey ?? "";
  const parsed =
    input.source === "manual"
      ? manualSkillsPreparationSchema.safeParse(input.state)
      : input.source === "quick_start"
        ? quickStartPreparationSchema.safeParse(input.state)
        : leanAiPreparationSchema.safeParse(input.state);
  if (!parsed.success) {
    return {
      error:
        "Those setup choices could not be saved. Check the fields and try again.",
    };
  }
  const preparation = renewSkillsPreparationKey(parsed.data, randomUUID());
  const saved = await saveSkillsSetupPreparation({
    source: input.source,
    templateKey,
    state: preparation,
  });
  if ("error" in saved && saved.error) {
    return { error: saved.error };
  }
  return { preparation };
}

async function readPreparation(
  source: "manual" | "quick_start" | "leanai",
  templateKey: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("skill_setup_preparations")
    .select("state")
    .eq("source", source)
    .eq("template_key", templateKey)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data.state;
}

export async function createManualSkillsSetupDraft(formData: FormData) {
  const publish = formData.get("publish") === "1";
  const stored = await readPreparation("manual", "");
  const parsed = manualSkillsPreparationSchema.safeParse(stored);
  if (!parsed.success) {
    return {
      error:
        "Save the scale, skills, and requirements before creating the draft.",
    };
  }
  const lists = await organisationAllowLists();
  const defined = manualPreparationToDefinition(
    parsed.data,
    lists.jobFunctionIds,
    lists.unitIds,
  );
  if (!defined.ok) {
    return { error: defined.message };
  }
  const created = await lists.supabase.rpc("create_skill_setup_draft", {
    target_idempotency_key: parsed.data.idempotencyKey,
    target_definition: defined.definition as unknown as Json,
  });
  if (created.error || !created.data) {
    return {
      error: toSkillsAuthoringError(
        created.error,
        "The draft could not be created. Nothing was saved or published. You can try again.",
      ),
    };
  }
  if (publish) {
    const published = await lists.supabase.rpc("publish_skill_setup_bundle", {
      target_bundle_id: created.data,
    });
    if (published.error) {
      revalidateSkillsSetup();
      return {
        error: toSkillsAuthoringError(
          published.error,
          "The draft was saved, but it was not published. Open the draft and publish it when it is ready.",
        ),
        bundleId: created.data,
      };
    }
  }
  revalidateSkillsSetup();
  redirect(`/platform/skills/setup/drafts/${created.data}`);
}

export async function createQuickStartSkillsDraft(formData: FormData) {
  const templateKey = String(formData.get("templateKey") ?? "");
  let pack;
  try {
    pack = requireSkillsStarterPack(templateKey);
  } catch {
    return { error: "That starting point is not available." };
  }
  const stored = await readPreparation("quick_start", pack.key);
  const parsed = quickStartPreparationSchema.safeParse(stored);
  if (!parsed.success) {
    return { error: "Save the role mapping before creating the draft." };
  }
  const lists = await organisationAllowLists();
  for (const mapping of parsed.data.roleMappings) {
    if (
      mapping.jobFunctionId &&
      !lists.jobFunctionIds.has(mapping.jobFunctionId)
    ) {
      return { error: "Choose a job function from this organisation." };
    }
  }
  const unitError = assertConfirmedSetupUnits({
    applicability: parsed.data.applicability,
    unitIds: parsed.data.unitIds,
    allowedUnitIds: lists.unitIds,
  });
  if (unitError) {
    return { error: unitError };
  }
  const defined = buildStarterPackDefinition({
    pack,
    applicability: parsed.data.applicability,
    unitIds: parsed.data.unitIds,
    roleMappings: parsed.data.roleMappings.map((mapping) => ({
      suggestedRole: mapping.suggestedRole,
      jobFunctionId: mapping.jobFunctionId,
    })),
    scaleResolution: parsed.data.scaleResolution,
  });
  if (!defined.ok) {
    return { error: defined.message };
  }
  const created = await lists.supabase.rpc("create_skill_setup_draft", {
    target_idempotency_key: parsed.data.idempotencyKey,
    target_definition: defined.definition as unknown as Json,
  });
  if (created.error || !created.data) {
    return {
      error: toSkillsAuthoringError(
        created.error,
        "The draft could not be created. Nothing was saved or published. You can try again.",
      ),
    };
  }
  revalidateSkillsSetup();
  redirect(`/platform/skills/setup/drafts/${created.data}`);
}

export async function publishSkillsSetupBundle(formData: FormData) {
  const bundleId = String(formData.get("bundleId") ?? "");
  if (!UUID_PATTERN.test(bundleId)) {
    return { error: "That setup draft could not be found." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("publish_skill_setup_bundle", {
    target_bundle_id: bundleId,
  });
  if (error) {
    return {
      error: toSkillsAuthoringError(
        error,
        "The setup could not be published. The draft is still here.",
      ),
    };
  }
  revalidateSkillsSetup();
  redirect("/platform/skills/matrix");
}

export async function discardSkillsSetupBundle(formData: FormData) {
  const bundleId = String(formData.get("bundleId") ?? "");
  if (!UUID_PATTERN.test(bundleId)) {
    return { error: "That setup draft could not be found." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("discard_skill_setup_bundle", {
    target_bundle_id: bundleId,
  });
  if (error) {
    return {
      error: toSkillsAuthoringError(
        error,
        "The draft could not be discarded. Published and referenced records were not removed.",
      ),
    };
  }
  revalidateSkillsSetup();
  redirect("/platform/skills/setup");
}

export async function sendSkillsSetupBuilderMessage(input: {
  message?: string;
  intent: "answer" | "propose" | "refine" | "retry";
  focus?: unknown;
  idempotencyKey?: string;
}) {
  const result = await sendModuleSetupBuilderMessage(
    skillsSetupBuilderModule,
    input,
  );
  if (!result.ok) {
    return {
      ok: false as const,
      message: result.message,
      proposal: null as SkillsBuilderProposal | null,
      proposalMessageId: null as string | null,
    };
  }
  const assistantTurn = [...result.conversation.turns]
    .reverse()
    .find((turn) => turn.role === "assistant");
  return {
    ok: true as const,
    outcome: result.outcome,
    message: assistantTurn?.message ?? "",
    questions: result.conversation.pendingQuestions,
    proposal: result.conversation.currentProposal?.proposal ?? null,
    proposalMessageId: result.conversation.currentProposal?.messageId ?? null,
    issues: assistantTurn?.proposalIssues ?? [],
  };
}

export async function createSkillsDraftFromProposal(formData: FormData) {
  const proposalMessageId = String(formData.get("proposalMessageId") ?? "");
  if (!UUID_PATTERN.test(proposalMessageId)) {
    return { error: "Choose a proposal to create." };
  }
  const stored = await readPreparation("leanai", "leanai-skills-builder");
  const parsed = leanAiPreparationSchema.safeParse(stored);
  if (!parsed.success) {
    return { error: "Save the role mapping before creating the draft." };
  }
  const supabase = await createServerSupabaseClient();
  const { data: sessionRow } = await supabase
    .from("ai_sessions")
    .select("id, organisation_id")
    .eq("context_type", "coach")
    .eq("module_key", "skills")
    .eq("intervention_key", "setup_builder")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sessionRow) {
    return {
      error: "The setup conversation could not be found. Nothing was created.",
    };
  }
  const conversation = await loadModuleSetupBuilderConversation(
    skillsSetupBuilderModule,
    sessionRow.organisation_id,
  );
  const current = conversation?.currentProposal ?? null;
  if (!current || current.messageId !== proposalMessageId) {
    return {
      error:
        "This proposal is no longer the latest one. Review the current proposal before creating a draft.",
    };
  }
  const lists = await organisationAllowLists();
  const unitError = assertConfirmedSetupUnits({
    applicability: parsed.data.applicability,
    unitIds: parsed.data.unitIds,
    allowedUnitIds: lists.unitIds,
  });
  if (unitError) {
    return { error: unitError };
  }
  const defined = skillsProposalToDefinition({
    proposal: current.proposal,
    applicability: parsed.data.applicability,
    unitIds: parsed.data.unitIds,
    roleMappings: parsed.data.roleMappings,
    allowedJobFunctionIds: lists.jobFunctionIds,
    allowedUnitIds: lists.unitIds,
  });
  if (!defined.ok) {
    return { error: defined.message };
  }
  const created = await lists.supabase.rpc("create_skill_setup_draft", {
    target_idempotency_key: parsed.data.idempotencyKey,
    target_definition: defined.definition as unknown as Json,
  });
  if (created.error || !created.data) {
    return {
      error: toSkillsAuthoringError(
        created.error,
        "The draft could not be created. Nothing was saved or published. You can try again from this proposal.",
      ),
    };
  }
  revalidateSkillsSetup();
  redirect(`/platform/skills/setup/drafts/${created.data}`);
}
