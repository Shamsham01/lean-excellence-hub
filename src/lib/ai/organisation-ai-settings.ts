export const MAX_MONTHLY_TOKEN_CEILING = 2_147_483_647;

const INVALID_CEILING_MESSAGE =
  "Enter a whole number greater than zero, or turn the pause off.";

const UNAUTHORISED_SETTINGS_MESSAGE =
  "You are not authorised to change LeanAI settings for this organisation.";

const GENERIC_SETTINGS_MESSAGE =
  "LeanAI settings could not be saved. Please try again.";

export function isValidMonthlyTokenCeiling(value: number): boolean {
  return (
    Number.isInteger(value) && value >= 1 && value <= MAX_MONTHLY_TOKEN_CEILING
  );
}

export function parseMonthlyTokenCeiling(
  raw: string,
): number | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const value = Number(trimmed);
  if (!isValidMonthlyTokenCeiling(value)) return "invalid";
  return value;
}

export function formatAiSettingsSaveError(error: {
  code?: string;
  message?: string;
}): string {
  const message = error.message?.trim().toLowerCase() ?? "";

  if (message.includes("invalid monthly token ceiling")) {
    return INVALID_CEILING_MESSAGE;
  }

  if (
    error.code === "42501" ||
    message.includes("not authorised") ||
    message.includes("not authorized") ||
    message.includes("permission denied")
  ) {
    return UNAUTHORISED_SETTINGS_MESSAGE;
  }

  return GENERIC_SETTINGS_MESSAGE;
}
