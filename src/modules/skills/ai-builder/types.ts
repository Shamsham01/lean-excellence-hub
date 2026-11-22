export const SKILLS_BUILDER_MODULE_KEY = "skills" as const;
export const SKILLS_BUILDER_SESSION_TITLE = "LeanAI Skills setup";
export const SKILLS_BUILDER_CONTEXT_CONTRACT =
  "skills-setup-builder-context-v1" as const;
export const SKILLS_BUILDER_PAYLOAD_KIND = "skills_setup_builder" as const;
export const SKILLS_BUILDER_DECLARED_KEY = "leanai-skills-builder" as const;
export const SKILLS_BUILDER_ROUTE = "/platform/skills/setup/leanai" as const;
export const SKILLS_BUILDER_COOKIE_PATH = "/platform/skills" as const;

export const SKILLS_BUILDER_LIMITS = {
  minLevels: 2,
  maxLevels: 8,
  minSkills: 1,
  maxSkills: 12,
  maxRequirements: 40,
  nameMax: 160,
  textMax: 500,
} as const;

export type SkillsBuilderProposal = {
  title: string;
  scale: {
    name: string;
    description: string | null;
    levels: Array<{ order: number; label: string; guidance: string | null }>;
  };
  skills: Array<{
    name: string;
    category: string | null;
    description: string | null;
    evidenceExpectations: string | null;
  }>;
  requirements: Array<{
    skillName: string;
    suggestedJobFunction: string;
    levelLabel: string;
    evidenceRequirement: string | null;
  }>;
  notes: string[];
};
