export type ResponsibilityKind =
  "module" | "admin" | "legacy" | "custom" | "owner";

export const moduleResponsibilityLabels: Record<string, string> = {
  admin: "Admin",
  maturity: "Maturity",
  five_s: "5S",
  gemba: "Gemba",
  actions: "Actions",
  projects: "Projects",
  benefits: "Benefits",
  problem_solving: "Problem Solving",
  suggestions: "Suggestions",
  people: "People",
  training: "Training",
  skills: "Skills",
  recognition: "Recognition",
};

export function responsibilityDisplayName(input: {
  role_display_name: string;
  module_responsibility_key?: string | null;
  responsibility_kind?: ResponsibilityKind | string | null;
}): string {
  if (input.module_responsibility_key) {
    return (
      moduleResponsibilityLabels[input.module_responsibility_key] ??
      input.role_display_name
    );
  }

  if (input.responsibility_kind === "admin") {
    return "Admin";
  }

  return input.role_display_name;
}

export function responsibilityScopeLabel(input: {
  scope_type: string;
  scope_unit_name?: string | null;
}): string {
  if (input.scope_type === "organisation") {
    return "Entire organisation";
  }

  if (input.scope_type === "unit_subtree" && input.scope_unit_name) {
    return `${input.scope_unit_name} subtree`;
  }

  if (input.scope_type === "self") {
    return "Self";
  }

  return input.scope_unit_name ?? input.scope_type;
}

export function isModuleResponsibilityOffer(
  responsibilityKind?: string | null,
): boolean {
  return responsibilityKind === "module" || responsibilityKind === "admin";
}
