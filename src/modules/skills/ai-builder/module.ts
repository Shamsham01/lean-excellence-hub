import "server-only";

import type { ModuleSetupBuilderModule } from "@/modules/module-setup/ai-builder/execute";
import { contextMarkers } from "@/modules/module-setup/ai-builder/context";
import { SKILLS_PERMISSIONS } from "@/modules/operational/permissions";
import {
  buildSkillsSetupBuilderSystemPrompt,
  hashSkillsSetupBuilderPrompt,
  SKILLS_SETUP_BUILDER_FORMAT_NAME,
  SKILLS_SETUP_BUILDER_JSON_SCHEMA,
  SKILLS_SETUP_BUILDER_PROMPT_KEY,
  SKILLS_SETUP_BUILDER_PROMPT_VERSION,
} from "@/platform/ai/prompts/skills-setup-builder";

import {
  parseSkillsBuilderEnvelope,
  revalidateStoredSkillsProposal,
} from "./proposal";
import {
  SKILLS_BUILDER_CONTEXT_CONTRACT,
  SKILLS_BUILDER_COOKIE_PATH,
  SKILLS_BUILDER_DECLARED_KEY,
  SKILLS_BUILDER_LIMITS,
  SKILLS_BUILDER_MODULE_KEY,
  SKILLS_BUILDER_PAYLOAD_KIND,
  SKILLS_BUILDER_ROUTE,
  SKILLS_BUILDER_SESSION_TITLE,
  type SkillsBuilderProposal,
} from "./types";

const systemPrompt = buildSkillsSetupBuilderSystemPrompt();
const markers = contextMarkers(SKILLS_BUILDER_CONTEXT_CONTRACT);

export const skillsSetupBuilderModule: ModuleSetupBuilderModule<SkillsBuilderProposal> =
  {
    moduleKey: SKILLS_BUILDER_MODULE_KEY,
    interventionKey: "setup_builder",
    sessionTitle: SKILLS_BUILDER_SESSION_TITLE,
    contextContract: SKILLS_BUILDER_CONTEXT_CONTRACT,
    cookiePath: SKILLS_BUILDER_COOKIE_PATH,
    managePermission: SKILLS_PERMISSIONS.requirementsManage,
    requiredPermissions: [
      SKILLS_PERMISSIONS.catalogManage,
      SKILLS_PERMISSIONS.requirementsManage,
    ],
    moduleLabel: "Skills",
    route: SKILLS_BUILDER_ROUTE,
    overviewPath: "/platform/skills",
    payloadKind: SKILLS_BUILDER_PAYLOAD_KIND,
    declaredKey: SKILLS_BUILDER_DECLARED_KEY,
    loadConfigurationNames: async (supabase) => {
      const [{ data: skills }, counted, { data: jobFunctions }] =
        await Promise.all([
          supabase
            .from("skills")
            .select("name")
            .eq("status", "active")
            .order("name")
            .limit(20),
          supabase
            .from("skills")
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
        names: (skills ?? []).map((skill) => skill.name),
        count: counted.count ?? 0,
        jobFunctionNames: (jobFunctions ?? []).map(
          (jobFunction) => jobFunction.name,
        ),
      };
    },
    limits: { ...SKILLS_BUILDER_LIMITS },
    adapter: {
      moduleKey: SKILLS_BUILDER_MODULE_KEY,
      interventionKey: "setup_builder",
      payloadKind: SKILLS_BUILDER_PAYLOAD_KIND,
      contextContract: SKILLS_BUILDER_CONTEXT_CONTRACT,
      promptKey: SKILLS_SETUP_BUILDER_PROMPT_KEY,
      promptVersion: SKILLS_SETUP_BUILDER_PROMPT_VERSION,
      formatName: SKILLS_SETUP_BUILDER_FORMAT_NAME,
      jsonSchema: SKILLS_SETUP_BUILDER_JSON_SCHEMA,
      systemPrompt,
      promptHash: hashSkillsSetupBuilderPrompt(systemPrompt),
      contextStart: markers.start,
      contextEnd: markers.end,
      denialReason: "skills_setup_builder_denied",
      parseEnvelope: (value) => {
        const parsed = parseSkillsBuilderEnvelope(value);
        if (!parsed.ok) {
          return parsed;
        }
        return { ok: true, envelope: parsed.envelope };
      },
    },
    revalidateProposal: revalidateStoredSkillsProposal,
    counts: (proposal) => ({
      sections: proposal.skills.length,
      items: proposal.requirements.length,
    }),
    sectionCount: (proposal) => proposal.skills.length,
    toContextProposal: (proposal) => proposal,
    definitionFromAcceptance: () => ({
      error:
        "Confirm job functions and applicability, then create the Skills draft from the stored proposal.",
    }),
    rpc: "create_skill_setup_draft",
    draftPath: (id) => `/platform/skills/setup/drafts/${id}`,
  };
