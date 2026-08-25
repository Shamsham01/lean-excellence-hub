import { createServerSupabaseClient } from "@/platform/supabase/server";

export async function loadScheduleFormContext() {
  const supabase = await createServerSupabaseClient();

  const { data: org } = await supabase
    .from("organisations")
    .select("time_zone")
    .maybeSingle();

  const { data: units } = await supabase
    .from("organisation_units")
    .select("id, name")
    .order("name");

  const { data: memberships } = await supabase
    .from("organisation_memberships")
    .select("id, display_name, user_id")
    .eq("status", "active")
    .order("display_name");

  return {
    timezone: org?.time_zone ?? "UTC",
    units: units ?? [],
    memberships:
      memberships?.map((m) => ({
        id: m.id,
        label: m.display_name ?? m.id,
      })) ?? [],
  };
}
