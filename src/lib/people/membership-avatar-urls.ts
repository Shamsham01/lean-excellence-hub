import "server-only";

import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function loadMembershipAvatarUrls(
  membershipIds: string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(membershipIds.filter(Boolean))];
  const map = new Map<string, string | null>();
  if (unique.length === 0) return map;

  const supabase = await createServerSupabaseClient();
  const { data: rows } = await supabase
    .from("organisation_memberships")
    .select("id, user_id")
    .in("id", unique);

  const userIds = [...new Set((rows ?? []).map((row) => row.user_id))];
  if (userIds.length === 0) {
    for (const id of unique) map.set(id, null);
    return map;
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, avatar_url")
    .in("user_id", userIds);

  const avatarByUser = new Map(
    (profiles ?? []).map((row) => [row.user_id, row.avatar_url]),
  );

  for (const row of rows ?? []) {
    map.set(row.id, avatarByUser.get(row.user_id) ?? null);
  }
  for (const id of unique) {
    if (!map.has(id)) map.set(id, null);
  }

  return map;
}
