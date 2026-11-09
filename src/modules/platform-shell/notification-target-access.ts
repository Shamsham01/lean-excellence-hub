import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/platform/supabase/database.types";

type AccessResult = { ok: true } | { ok: false; message: string };

const UNAVAILABLE_MESSAGE =
  "This item is no longer available or you do not have access to it.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Lightweight existence checks under RLS before navigating from the notification centre.
 */
export async function assertPlatformNotificationTargetAccessible(
  supabase: SupabaseClient<Database>,
  href: string,
): Promise<AccessResult> {
  let pathname: string;
  let searchParams: URLSearchParams;

  try {
    const url = new URL(href, "http://placeholder.local");
    pathname = url.pathname;
    searchParams = url.searchParams;
  } catch {
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  }

  if (!pathname.startsWith("/platform/")) {
    return { ok: true };
  }

  if (pathname === "/platform/actions" || pathname === "/platform/scheduling") {
    return { ok: true };
  }

  if (pathname.startsWith("/platform/suggestions/review")) {
    const suggestionId = searchParams.get("suggestionId");
    if (isUuid(suggestionId)) {
      return await suggestionExists(supabase, suggestionId);
    }
    return { ok: true };
  }

  const suggestionDetailMatch = pathname.match(
    /^\/platform\/suggestions\/([^/]+)$/,
  );
  if (suggestionDetailMatch) {
    const suggestionId = suggestionDetailMatch[1];
    if (
      suggestionId !== "new" &&
      suggestionId !== "review" &&
      isUuid(suggestionId)
    ) {
      return await suggestionExists(supabase, suggestionId);
    }
  }

  const actionMatch = pathname.match(/^\/platform\/actions\/([^/]+)$/);
  if (actionMatch && isUuid(actionMatch[1])) {
    return await recordExists(supabase, "actions", actionMatch[1]);
  }

  const walkMatch = pathname.match(/^\/platform\/gemba\/walks\/([^/]+)$/);
  if (walkMatch && isUuid(walkMatch[1])) {
    return await recordExists(supabase, "gemba_walks", walkMatch[1]);
  }

  const auditMatch = pathname.match(/^\/platform\/5s\/audits\/([^/]+)$/);
  if (auditMatch && isUuid(auditMatch[1])) {
    return await recordExists(supabase, "five_s_audits", auditMatch[1]);
  }

  return { ok: true };
}

async function suggestionExists(
  supabase: SupabaseClient<Database>,
  suggestionId: string,
): Promise<AccessResult> {
  const { data, error } = await supabase
    .from("improvement_suggestions")
    .select("id")
    .eq("id", suggestionId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  }

  return { ok: true };
}

async function recordExists(
  supabase: SupabaseClient<Database>,
  table: "actions" | "gemba_walks" | "five_s_audits",
  id: string,
): Promise<AccessResult> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  }

  return { ok: true };
}
