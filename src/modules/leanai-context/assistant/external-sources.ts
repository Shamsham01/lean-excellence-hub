export type ExternalWebSource = {
  title: string;
  url: string;
};

const MAX_SOURCE_TITLE = 120;
const MAX_SOURCE_URL = 500;
const MAX_DISPLAYED_SOURCES = 8;

function hostnameLabel(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}

export function canonicalExternalUrl(raw: string): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_SOURCE_URL) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  if (parsed.username || parsed.password) {
    parsed.username = "";
    parsed.password = "";
  }
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

export function sanitiseExternalWebSource(input: {
  title?: unknown;
  url?: unknown;
}): ExternalWebSource | null {
  const url = canonicalExternalUrl(
    typeof input.url === "string" ? input.url : "",
  );
  if (!url) {
    return null;
  }
  const rawTitle =
    typeof input.title === "string"
      ? input.title
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]*>/g, "")
          .trim()
      : "";
  const parsed = new URL(url);
  const title = (rawTitle || hostnameLabel(parsed.hostname)).slice(
    0,
    MAX_SOURCE_TITLE,
  );
  if (!title) {
    return null;
  }
  return { title, url };
}

export function sanitiseExternalWebSources(
  values: unknown,
  limit = MAX_DISPLAYED_SOURCES,
): ExternalWebSource[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const seen = new Set<string>();
  const sources: ExternalWebSource[] = [];
  for (const value of values) {
    const record =
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    const source = sanitiseExternalWebSource({
      title: record?.title,
      url: record?.url,
    });
    if (!source || seen.has(source.url)) {
      continue;
    }
    seen.add(source.url);
    sources.push(source);
    if (sources.length >= limit) {
      break;
    }
  }
  return sources;
}

export function hostLabelFromUrl(url: string): string {
  try {
    return hostnameLabel(new URL(url).hostname);
  } catch {
    return url;
  }
}
