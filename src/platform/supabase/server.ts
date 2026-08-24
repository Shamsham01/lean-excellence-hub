import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnvironment } from "@/platform/env";
import type { Database } from "@/platform/supabase/database.types";

export async function createServerSupabaseClient() {
  const environment = getPublicEnvironment();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot write cookies; the root proxy refreshes them.
          }
        },
      },
    },
  );
}
