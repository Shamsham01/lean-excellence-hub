export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function boundedText(
  value: unknown,
  max: number,
  required: boolean,
): { ok: true; value: string | null } | { ok: false; issue: string } {
  if (value == null) {
    return required
      ? { ok: false, issue: "Required text is missing." }
      : { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, issue: "Text must be a string." };
  }
  const trimmed = collapseWhitespace(value);
  if (!trimmed) {
    return required
      ? { ok: false, issue: "Required text is empty." }
      : { ok: true, value: null };
  }
  if (trimmed.length > max) {
    return { ok: false, issue: `Text is longer than ${max} characters.` };
  }
  return { ok: true, value: trimmed };
}
