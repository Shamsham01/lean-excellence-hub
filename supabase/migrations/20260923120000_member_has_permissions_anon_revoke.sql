-- Least-privilege follow-up for batch permission probe (PERF-001).
-- Anonymous callers already receive explicit denials; revoke unnecessary PUBLIC/anon EXECUTE.

revoke all on function public.member_has_permissions(text[]) from public, anon;

grant execute on function public.member_has_permissions(text[]) to authenticated;
