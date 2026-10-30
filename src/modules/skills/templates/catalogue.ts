import { foodProductionSkillsPack } from "./food-production";
import { generalManufacturingSkillsPack } from "./general-manufacturing";
import {
  SKILLS_STARTER_PACK_KEYS,
  type SkillsStarterPack,
  type SkillsStarterPackKey,
} from "./types";

const PACKS: Record<SkillsStarterPackKey, SkillsStarterPack> = {
  "leh-general-manufacturing-skills": generalManufacturingSkillsPack,
  "leh-food-production-skills": foodProductionSkillsPack,
};

export function listSkillsStarterPacks(): SkillsStarterPack[] {
  return SKILLS_STARTER_PACK_KEYS.map((key) => PACKS[key]);
}

export function requireSkillsStarterPack(key: string): SkillsStarterPack {
  if (!isSkillsStarterPackKey(key)) {
    throw new Error("Unknown skills starter pack.");
  }
  return PACKS[key];
}

export function isSkillsStarterPackKey(
  key: string,
): key is SkillsStarterPackKey {
  return (SKILLS_STARTER_PACK_KEYS as readonly string[]).includes(key);
}

export function starterPackRoleTitles(pack: SkillsStarterPack): string[] {
  return pack.suggestedRoles.map((role) => role.title);
}

export function starterPackUsesRoleTitlesAsSkills(
  pack: SkillsStarterPack,
): string[] {
  const roles = new Set(
    pack.suggestedRoles.map((role) => role.title.trim().toLowerCase()),
  );
  return pack.skills
    .filter((skill) => roles.has(skill.name.trim().toLowerCase()))
    .map((skill) => skill.name);
}
