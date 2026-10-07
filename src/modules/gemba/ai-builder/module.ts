import "server-only";

import type { ModuleSetupBuilderModule } from "@/modules/module-setup/ai-builder/execute";
import { contextMarkers } from "@/modules/module-setup/ai-builder/context";
import { GEMBA_PERMISSIONS } from "@/modules/operational/permissions";
import {
  buildGembaSetupBuilderSystemPrompt,
  GEMBA_SETUP_BUILDER_FORMAT_NAME,
  GEMBA_SETUP_BUILDER_JSON_SCHEMA,
  GEMBA_SETUP_BUILDER_PROMPT_KEY,
  GEMBA_SETUP_BUILDER_PROMPT_VERSION,
  hashGembaSetupBuilderPrompt,
} from "@/platform/ai/prompts/gemba-setup-builder";
import type { Json } from "@/platform/supabase/database.types";

import {
  gembaBuilderProposalToDefinition,
  parseGembaBuilderEnvelope,
  revalidateStoredGembaProposal,
} from "./proposal";
import {
  GEMBA_BUILDER_CONTEXT_CONTRACT,
  GEMBA_BUILDER_COOKIE_PATH,
  GEMBA_BUILDER_DECLARED_KEY,
  GEMBA_BUILDER_LIMITS,
  GEMBA_BUILDER_MODULE_KEY,
  GEMBA_BUILDER_PAYLOAD_KIND,
  GEMBA_BUILDER_ROUTE,
  GEMBA_BUILDER_SESSION_TITLE,
  type GembaBuilderProposal,
} from "./types";

const systemPrompt = buildGembaSetupBuilderSystemPrompt();
const markers = contextMarkers(GEMBA_BUILDER_CONTEXT_CONTRACT);

export const gembaSetupBuilderModule: ModuleSetupBuilderModule<GembaBuilderProposal> =
  {
    moduleKey: GEMBA_BUILDER_MODULE_KEY,
    interventionKey: "setup_builder",
    sessionTitle: GEMBA_BUILDER_SESSION_TITLE,
    contextContract: GEMBA_BUILDER_CONTEXT_CONTRACT,
    cookiePath: GEMBA_BUILDER_COOKIE_PATH,
    managePermission: GEMBA_PERMISSIONS.definitionsManage,
    moduleLabel: "Gemba definitions",
    route: GEMBA_BUILDER_ROUTE,
    overviewPath: "/platform/gemba",
    payloadKind: GEMBA_BUILDER_PAYLOAD_KIND,
    declaredKey: GEMBA_BUILDER_DECLARED_KEY,
    namesTable: "gemba_definitions",
    limits: { ...GEMBA_BUILDER_LIMITS },
    revalidateProposal: revalidateStoredGembaProposal,
    counts: (proposal) => ({
      sections: proposal.sections.length,
      items: proposal.sections.reduce(
        (count, section) => count + section.prompts.length,
        0,
      ),
    }),
    sectionCount: (proposal) => proposal.sections.length,
    toContextProposal: (proposal) => proposal,
    definitionFromAcceptance: (proposal) => ({
      definition: gembaBuilderProposalToDefinition(proposal) as Json,
    }),
    rpc: "create_gemba_definition_draft_from_definition",
    draftPath: (id) => `/platform/gemba/definitions/${id}`,
    adapter: {
      moduleKey: "gemba",
      interventionKey: "setup_builder",
      payloadKind: GEMBA_BUILDER_PAYLOAD_KIND,
      contextContract: GEMBA_BUILDER_CONTEXT_CONTRACT,
      promptKey: GEMBA_SETUP_BUILDER_PROMPT_KEY,
      promptVersion: GEMBA_SETUP_BUILDER_PROMPT_VERSION,
      formatName: GEMBA_SETUP_BUILDER_FORMAT_NAME,
      jsonSchema: GEMBA_SETUP_BUILDER_JSON_SCHEMA as unknown as Record<
        string,
        unknown
      >,
      systemPrompt,
      promptHash: hashGembaSetupBuilderPrompt(systemPrompt),
      contextStart: markers.start,
      contextEnd: markers.end,
      denialReason: "setup_builder_has_no_tools",
      parseEnvelope: (value) => {
        const parsed = parseGembaBuilderEnvelope(value);
        if (!parsed.ok) {
          return parsed;
        }
        return { ok: true, envelope: parsed.envelope };
      },
    },
  };
