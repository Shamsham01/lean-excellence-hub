export function normalizeApplicationOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export function validateApplicationOrigin(origin: string): string {
  const normalized = normalizeApplicationOrigin(origin.trim());

  if (!normalized) {
    throw new Error("APP_ORIGIN is required.");
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("APP_ORIGIN must be a valid absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_ORIGIN must use http or https.");
  }

  if (!url.host) {
    throw new Error("APP_ORIGIN must include a host.");
  }

  return `${url.protocol}//${url.host}`;
}
