import "server-only";

import type { ModuleSetupBuilderModule } from "@/modules/module-setup/ai-builder/execute";
import { contextMarkers } from "@/modules/module-setup/ai-builder/context";
import { TRAINING_PERMISSIONS } from "@/modules/operational/permissions";
import {
  buildTrainingSetupBuilderSystemPrompt,
  hashTrainingSetupBuilderPrompt,
  TRAINING_SETUP_BUILDER_FORMAT_NAME,
  TRAINING_SETUP_BUILDER_JSON_SCHEMA,
  TRAINING_SETUP_BUILDER_PROMPT_KEY,
  TRAINING_SETUP_BUILDER_PROMPT_VERSION,
} from "@/platform/ai/prompts/training-setup-builder";

import {
  parseTrainingBuilderEnvelope,
  revalidateStoredTrainingProposal,
} from "./proposal";
import {
  TRAINING_BUILDER_CONTEXT_CONTRACT,
  TRAINING_BUILDER_COOKIE_PATH,
  TRAINING_BUILDER_DECLARED_KEY,
  TRAINING_BUILDER_LIMITS,
  TRAINING_BUILDER_MODULE_KEY,
  TRAINING_BUILDER_PAYLOAD_KIND,
  TRAINING_BUILDER_ROUTE,
  TRAINING_BUILDER_SESSION_TITLE,
  type TrainingBuilderProposal,
} from "./types";

const systemPrompt = buildTrainingSetupBuilderSystemPrompt();
const markers = contextMarkers(TRAINING_BUILDER_CONTEXT_CONTRACT);

export const trainingSetupBuilderModule: ModuleSetupBuilderModule<TrainingBuilderProposal> =
  {
    moduleKey: TRAINING_BUILDER_MODULE_KEY,
    interventionKey: "setup_builder",
    sessionTitle: TRAINING_BUILDER_SESSION_TITLE,
    contextContract: TRAINING_BUILDER_CONTEXT_CONTRACT,
    cookiePath: TRAINING_BUILDER_COOKIE_PATH,
    managePermission: TRAINING_PERMISSIONS.curriculumManage,
    requiredPermissions: [
      TRAINING_PERMISSIONS.catalogManage,
      TRAINING_PERMISSIONS.curriculumManage,
    ],
    moduleLabel: "Training",
    route: TRAINING_BUILDER_ROUTE,
    overviewPath: "/platform/training",
    payloadKind: TRAINING_BUILDER_PAYLOAD_KIND,
    declaredKey: TRAINING_BUILDER_DECLARED_KEY,
    loadConfigurationNames: async (supabase) => {
      const [{ data: courses }, counted, { data: jobFunctions }] =
        await Promise.all([
          supabase
            .from("training_courses")
            .select("name")
            .eq("status", "active")
            .order("name")
            .limit(20),
          supabase
            .from("training_courses")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("job_functions")
            .select("name")
            .eq("status", "active")
            .order("name")
            .limit(40),
        ]);
      return {
        names: (courses ?? []).map((course) => course.name),
        count: counted.count ?? 0,
        jobFunctionNames: (jobFunctions ?? []).map(
          (jobFunction) => jobFunction.name,
        ),
      };
    },
    limits: { ...TRAINING_BUILDER_LIMITS },
    adapter: {
      moduleKey: TRAINING_BUILDER_MODULE_KEY,
      interventionKey: "setup_builder",
      payloadKind: TRAINING_BUILDER_PAYLOAD_KIND,
      contextContract: TRAINING_BUILDER_CONTEXT_CONTRACT,
      promptKey: TRAINING_SETUP_BUILDER_PROMPT_KEY,
      promptVersion: TRAINING_SETUP_BUILDER_PROMPT_VERSION,
      formatName: TRAINING_SETUP_BUILDER_FORMAT_NAME,
      jsonSchema: TRAINING_SETUP_BUILDER_JSON_SCHEMA,
      systemPrompt,
      promptHash: hashTrainingSetupBuilderPrompt(systemPrompt),
      contextStart: markers.start,
      contextEnd: markers.end,
      denialReason: "training_setup_builder_denied",
      parseEnvelope: (value) => {
        const parsed = parseTrainingBuilderEnvelope(value);
        if (!parsed.ok) {
          return parsed;
        }
        return { ok: true, envelope: parsed.envelope };
      },
    },
    revalidateProposal: revalidateStoredTrainingProposal,
    counts: (proposal) => ({
      sections: proposal.courses.length,
      items: proposal.curriculum?.requirements.length ?? 0,
    }),
    sectionCount: (proposal) => proposal.courses.length,
    toContextProposal: (proposal) => proposal,
    definitionFromAcceptance: () => ({
      error:
        "Map job functions to the proposal roles, then create the Training draft from the stored proposal.",
    }),
    rpc: "create_training_setup_draft",
    draftPath: (id) => `/platform/training/setup/drafts/${id}`,
  };
