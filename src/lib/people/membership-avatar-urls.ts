import "server-only";

import type { PeopleDirectoryPayload } from "@/lib/people/directory-types";
import { createServerSupabaseClient } from "@/platform/supabase/server";

const DIRECTORY_PAGE_SIZE = 100;

export async function loadMembershipAvatarUrls(
  membershipIds: string[],
): Promise<Map<string, string | null>> {
  const unique = [...new Set(membershipIds.filter(Boolean))];
  const map = new Map<string, string | null>();
  if (unique.length === 0) return map;

  const needed = new Set(unique);
  const supabase = await createServerSupabaseClient();
  let page = 1;
  let totalCount: number | null = null;

  while (needed.size > 0) {
    const { data, error } = await supabase.rpc("get_people_directory", {
      target_search: null,
      target_page: page,
      target_page_size: DIRECTORY_PAGE_SIZE,
      target_include_inactive: false,
    });

    if (error) {
      console.error(
        "[loadMembershipAvatarUrls] get_people_directory failed",
        error.message,
      );
      break;
    }

    const payload = (data ?? null) as PeopleDirectoryPayload | null;
    const people = payload?.people ?? [];
    totalCount = payload?.total_count ?? totalCount;

    for (const person of people) {
      if (needed.has(person.membership_id)) {
        map.set(person.membership_id, person.avatar_url ?? null);
        needed.delete(person.membership_id);
      }
    }

    if (people.length < DIRECTORY_PAGE_SIZE) {
      break;
    }
    if (totalCount != null && page * DIRECTORY_PAGE_SIZE >= totalCount) {
      break;
    }
    page += 1;
  }

  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, null);
    }
  }

  return map;
}
