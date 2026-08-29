import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { normalizeApplicationOrigin } from "@/platform/application-origin";
import { getPublicEnvironment, getServerEnvironment } from "@/platform/env";
import type { Database } from "@/platform/supabase/database.types";

function canonicalizeLocalRequestOrigin(request: NextRequest) {
  const configuredOrigin = normalizeApplicationOrigin(
    getServerEnvironment().APP_ORIGIN,
  );
  let configuredHost: string;
  try {
    configuredHost = new URL(configuredOrigin).hostname;
  } catch {
    return null;
  }

  if (
    request.nextUrl.hostname === "localhost" &&
    configuredHost === "127.0.0.1"
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = configuredHost;
    redirectUrl.protocol = "http:";
    return NextResponse.redirect(redirectUrl, 308);
  }

  return null;
}

export async function refreshSupabaseSession(request: NextRequest) {
  const canonicalRedirect = canonicalizeLocalRequestOrigin(request);
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  const environment = getPublicEnvironment();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}
