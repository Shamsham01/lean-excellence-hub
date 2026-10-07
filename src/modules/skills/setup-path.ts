export type SkillsSetupSnapshot = {
  publishedScaleCount: number;
  draftScaleId: string | null;
  activeSkillCount: number;
  publishedStandardCount: number;
  draftStandardId: string | null;
};

export function nextSkillsSetupHref(input: SkillsSetupSnapshot) {
  if (input.publishedScaleCount === 0) {
    return input.draftScaleId
      ? `/platform/skills/scales/${input.draftScaleId}`
      : "/platform/skills/scales/new";
  }

  if (input.activeSkillCount === 0) {
    return "/platform/skills/catalog?new=1";
  }

  if (input.publishedStandardCount === 0) {
    return input.draftStandardId
      ? `/platform/skills/standards/${input.draftStandardId}`
      : "/platform/skills/standards/new";
  }

  return "/platform/skills/matrix";
}

export function skillsFrameworkIsUnconfigured(input: SkillsSetupSnapshot) {
  return (
    input.publishedScaleCount === 0 &&
    input.draftScaleId === null &&
    input.activeSkillCount === 0 &&
    input.publishedStandardCount === 0 &&
    input.draftStandardId === null
  );
}

export function skillsSetupStepNeeds(href: string) {
  if (href.includes("/scales") || href.includes("/catalog")) {
    return "catalog" as const;
  }

  if (href.includes("/standards")) {
    return "requirements" as const;
  }

  return "read" as const;
}
