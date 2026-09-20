-- Align get_suggestion_detail execute grants with sibling action lifecycle RPCs.

revoke all on function public.get_suggestion_detail(uuid) from public, anon;
