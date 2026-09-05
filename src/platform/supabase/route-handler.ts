import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnvironment } from "@/platform/env";
import type { Database } from "@/platform/supabase/database.types";

export type RouteHandlerSupabaseClient = SupabaseClient<Database>;

export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  response: NextResponse,
): RouteHandlerSupabaseClient {
  const environment = getPublicEnvironment();

  return createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );
}
