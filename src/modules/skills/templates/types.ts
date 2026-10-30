export const SKILLS_STARTER_PACK_VERSION = "2026-10-29";

export const SKILLS_STARTER_PACK_KEYS = [
  "leh-general-manufacturing-skills",
  "leh-food-production-skills",
] as const;

export type SkillsStarterPackKey = (typeof SKILLS_STARTER_PACK_KEYS)[number];

export type SkillsStarterLevel = {
  order: number;
  label: string;
  guidance: string;
};

export type SkillsStarterSkill = {
  name: string;
  category: string;
  description: string;
  evidenceExpectations: string;
};

export type SkillsStarterRole = {
  title: string;
  summary: string;
};

export type SkillsStarterRequirement = {
  skillName: string;
  roleTitle: string;
  levelLabel: string;
  evidence: string;
};

export type SkillsStarterPack = {
  key: SkillsStarterPackKey;
  version: string;
  name: string;
  summary: string;
  disclaimer: string | null;
  scaleName: string;
  scaleDescription: string;
  levels: readonly SkillsStarterLevel[];
  skills: readonly SkillsStarterSkill[];
  suggestedRoles: readonly SkillsStarterRole[];
  requirements: readonly SkillsStarterRequirement[];
};
