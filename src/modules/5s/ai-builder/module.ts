import "server-only";

import type { ModuleSetupBuilderModule } from "@/modules/module-setup/ai-builder/execute";
import { contextMarkers } from "@/modules/module-setup/ai-builder/context";
import { FIVE_S_PERMISSIONS } from "@/modules/operational/permissions";
import { parseFiveSThreshold } from "@/modules/5s/templates";
import {
  buildFiveSSetupBuilderSystemPrompt,
  FIVE_S_SETUP_BUILDER_FORMAT_NAME,
  FIVE_S_SETUP_BUILDER_JSON_SCHEMA,
  FIVE_S_SETUP_BUILDER_PROMPT_KEY,
  FIVE_S_SETUP_BUILDER_PROMPT_VERSION,
  hashFiveSSetupBuilderPrompt,
} from "@/platform/ai/prompts/five-s-setup-builder";
import type { Json } from "@/platform/supabase/database.types";

import {
  fiveSBuilderProposalToDefinition,
  parseFiveSBuilderEnvelope,
  revalidateStoredFiveSProposal,
} from "./proposal";
import {
  FIVE_S_BUILDER_CONTEXT_CONTRACT,
  FIVE_S_BUILDER_COOKIE_PATH,
  FIVE_S_BUILDER_DECLARED_KEY,
  FIVE_S_BUILDER_LIMITS,
  FIVE_S_BUILDER_MODULE_KEY,
  FIVE_S_BUILDER_PAYLOAD_KIND,
  FIVE_S_BUILDER_ROUTE,
  FIVE_S_BUILDER_SESSION_TITLE,
  type FiveSBuilderProposal,
} from "./types";

const systemPrompt = buildFiveSSetupBuilderSystemPrompt();
const markers = contextMarkers(FIVE_S_BUILDER_CONTEXT_CONTRACT);

export const fiveSSetupBuilderModule: ModuleSetupBuilderModule<FiveSBuilderProposal> =
  {
    moduleKey: FIVE_S_BUILDER_MODULE_KEY,
    interventionKey: "setup_builder",
    sessionTitle: FIVE_S_BUILDER_SESSION_TITLE,
    contextContract: FIVE_S_BUILDER_CONTEXT_CONTRACT,
    cookiePath: FIVE_S_BUILDER_COOKIE_PATH,
    managePermission: FIVE_S_PERMISSIONS.standardsManage,
    moduleLabel: "5S standards",
    route: FIVE_S_BUILDER_ROUTE,
    overviewPath: "/platform/5s",
    payloadKind: FIVE_S_BUILDER_PAYLOAD_KIND,
    declaredKey: FIVE_S_BUILDER_DECLARED_KEY,
    namesTable: "five_s_standards",
    limits: { ...FIVE_S_BUILDER_LIMITS },
    revalidateProposal: revalidateStoredFiveSProposal,
    counts: (proposal) => ({
      sections: proposal.categories.length,
      items: proposal.categories.reduce(
        (count, category) => count + category.questions.length,
        0,
      ),
    }),
    sectionCount: (proposal) => proposal.categories.length,
    toContextProposal: (proposal) => proposal,
    definitionFromAcceptance: (proposal, formData) => {
      const threshold = parseFiveSThreshold(
        String(formData.get("threshold") ?? proposal.thresholdPercent),
      );
      if (threshold == null) {
        return { error: "Enter a target threshold between 0 and 100." };
      }
      return {
        definition: fiveSBuilderProposalToDefinition(
          proposal,
          threshold,
        ) as Json,
      };
    },
    rpc: "create_five_s_standard_draft_from_definition",
    draftPath: (id) => `/platform/5s/standards/${id}`,
    adapter: {
      moduleKey: "five_s",
      interventionKey: "setup_builder",
      payloadKind: FIVE_S_BUILDER_PAYLOAD_KIND,
      contextContract: FIVE_S_BUILDER_CONTEXT_CONTRACT,
      promptKey: FIVE_S_SETUP_BUILDER_PROMPT_KEY,
      promptVersion: FIVE_S_SETUP_BUILDER_PROMPT_VERSION,
      formatName: FIVE_S_SETUP_BUILDER_FORMAT_NAME,
      jsonSchema: FIVE_S_SETUP_BUILDER_JSON_SCHEMA as unknown as Record<
        string,
        unknown
      >,
      systemPrompt,
      promptHash: hashFiveSSetupBuilderPrompt(systemPrompt),
      contextStart: markers.start,
      contextEnd: markers.end,
      denialReason: "setup_builder_has_no_tools",
      parseEnvelope: (value) => {
        const parsed = parseFiveSBuilderEnvelope(value);
        if (!parsed.ok) {
          return parsed;
        }
        return { ok: true, envelope: parsed.envelope };
      },
    },
  };
