import { isSiteUnitType } from "@/modules/organisation/site-semantics";

export const COMMON_UNIT_TYPES = [
  { value: "department", label: "Department" },
  { value: "area", label: "Area" },
  { value: "team", label: "Team" },
  { value: "line", label: "Line" },
  { value: "function", label: "Function" },
] as const;

export const CUSTOM_UNIT_TYPE_CHOICE = "custom";

export type CommonUnitTypeValue = (typeof COMMON_UNIT_TYPES)[number]["value"];

export function isCommonUnitType(
  value: string | null | undefined,
): value is CommonUnitTypeValue {
  if (!value) {
    return false;
  }
  return COMMON_UNIT_TYPES.some(
    (option) => option.value === value.trim().toLowerCase(),
  );
}

export function formatUnitTypeLabel(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "Unit";
  }

  const common = COMMON_UNIT_TYPES.find(
    (option) => option.value === trimmed.toLowerCase(),
  );
  if (common) {
    return common.label;
  }

  return trimmed
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveUnitTypeChoice(value: string | null | undefined) {
  if (!value?.trim()) {
    return "";
  }
  if (isCommonUnitType(value)) {
    return value.trim().toLowerCase();
  }
  return CUSTOM_UNIT_TYPE_CHOICE;
}

export function siteTypeCreationHint(unitType: string | null | undefined) {
  if (!isSiteUnitType(unitType)) {
    return null;
  }
  return "This label is treated as a Site. Sites are billable security boundaries, not ordinary departments or teams.";
}
