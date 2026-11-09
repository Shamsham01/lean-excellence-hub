const ALLOWED_MAILPIT_CAPTURE_ORIGINS = new Set([
  "http://127.0.0.1:54324",
  "http://localhost:54324",
  "http://host.docker.internal:54324",
  "http://172.17.0.1:54324",
]);

const LOCAL_SUPABASE_HOSTNAMES = new Set(["127.0.0.1", "localhost", "kong"]);

export function isLocalSupabaseInvitationDeliveryRuntime(
  readEnv: (name: string) => string | undefined,
): boolean {
  const raw = readEnv("SUPABASE_URL")?.trim();
  if (!raw) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!LOCAL_SUPABASE_HOSTNAMES.has(hostname)) {
    return false;
  }

  if (hostname === "kong") {
    return parsed.port === "8000" || parsed.port === "";
  }

  return true;
}

export function resolveInvitationDeliveryMailpitCaptureUrl(
  readEnv: (name: string) => string | undefined,
): string | null {
  const configured = readEnv("INVITATION_DELIVERY_MAILPIT_URL")?.trim();
  if (!configured) {
    return null;
  }

  if (!isLocalSupabaseInvitationDeliveryRuntime(readEnv)) {
    throw new Error(
      "INVITATION_DELIVERY_MAILPIT_URL is only permitted for local Supabase development.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(
      "INVITATION_DELIVERY_MAILPIT_URL must be a valid absolute URL.",
    );
  }

  if (parsed.protocol !== "http:") {
    throw new Error("INVITATION_DELIVERY_MAILPIT_URL must use http.");
  }

  if (parsed.username || parsed.password) {
    throw new Error(
      "INVITATION_DELIVERY_MAILPIT_URL must not include credentials.",
    );
  }

  const normalised = `${parsed.protocol}//${parsed.host}`.replace(/\/$/, "");
  if (!ALLOWED_MAILPIT_CAPTURE_ORIGINS.has(normalised)) {
    throw new Error(
      "INVITATION_DELIVERY_MAILPIT_URL is not on the local Mailpit allowlist.",
    );
  }

  return normalised;
}
