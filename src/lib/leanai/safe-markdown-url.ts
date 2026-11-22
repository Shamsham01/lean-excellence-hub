const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Allowlist for links inside untrusted LeanAI Markdown.
 * Rejects javascript:, data:, protocol-relative URLs, and credentialed URLs.
 */
export function safeMarkdownHref(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2_000) return null;
  if (trimmed.startsWith("//")) return null;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;

  if (parsed.protocol === "mailto:") {
    return parsed.pathname.includes("@") ? parsed.toString() : null;
  }

  return parsed.toString();
}
